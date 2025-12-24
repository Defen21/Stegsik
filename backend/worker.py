from celery import Celery
import time
import os
import subprocess
import shutil
from PIL import Image
import numpy as np
import mimetypes

# Configure Celery to use Redis
redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("worker", broker=redis_url, backend=redis_url)

def run_command(command):
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        return result.stdout + result.stderr
    except Exception as e:
        return str(e)

def generate_bit_planes(image_path, output_dir):
    try:
        img = Image.open(image_path).convert('RGB')
        arr = np.array(img)
        planes = {}
        
        # Channels: 0=R, 1=G, 2=B
        channels = ['Red', 'Green', 'Blue']
        
        for ch_idx, channel_name in enumerate(channels):
            for bit in range(8):
                # Extract specific bit
                # (arr[:,:,ch_idx] >> bit) & 1  -> gives 0 or 1
                # * 255 -> gives 0 or 255 for visibility
                plane = ((arr[:, :, ch_idx] >> bit) & 1) * 255
                plane_img = Image.fromarray(plane.astype('uint8'))
                
                filename = f"bitplane_{channel_name}_{bit}.png"
                save_path = os.path.join(output_dir, filename)
                plane_img.save(save_path)
                
                planes[f"{channel_name} {bit}"] = filename
                
        return planes
    except Exception as e:
        return {"error": str(e)}

@celery_app.task
def analyze_image_task(file_path):
    # Ensure absolute path for file_path
    abs_file_path = os.path.abspath(file_path)
    
    # Directory for analysis artifacts (bit planes, extracted files)
    # Directory for analysis artifacts (bit planes, extracted files)
    base_dir = os.path.dirname(abs_file_path)
    filename = os.path.basename(abs_file_path)
    result_dir_name = f"results_{filename}"
    result_dir = os.path.join(base_dir, result_dir_name)
    os.makedirs(result_dir, exist_ok=True)

    # Helper to save text output
    def save_output(tool_name, content):
        output_filename = f"{tool_name}_output.log"
        output_path = os.path.join(result_dir, output_filename)
        with open(output_path, "w") as f:
            f.write(content)
        return {
            "content": content,
            "file_path": f"{result_dir_name}/{output_filename}"
        }

    # 1. Generate Bit Planes
    bit_planes = generate_bit_planes(abs_file_path, result_dir) # Returns filenames directly in result_dir
    # Bit planes are in result_dir, so path is outputs/results_.../filename
    
    # Create a zip of all generated images (bitplanes)
    images_zip_name = os.path.join(result_dir, "all_images")
    # We want to zip only the png files we just created
    import zipfile
    with zipfile.ZipFile(f"{images_zip_name}.zip", 'w') as zipf:
        for root, dirs, files in os.walk(result_dir):
            for file in files:
                if file.startswith("bitplane_") and file.endswith(".png"):
                    zipf.write(os.path.join(root, file), file)
    
    images_zip_path = f"{result_dir_name}/all_images.zip"

    # 2. Run Forensic Tools
    results = {}
    
    # zsteg (Ruby tool, good for LSB)
    zsteg_out = run_command(["zsteg", "-a", abs_file_path])
    results['zsteg'] = save_output('zsteg', zsteg_out)
    
    # Stegseek (Ultra-fast Steghide Cracker)
    wordlist_path = "wordlist.txt"
    # Force output to a specific file in the result directory
    expected_out_file = os.path.join(result_dir, "stegseek_extracted.bin")
    
    stegseek_cmd = ["stegseek", "-xf", expected_out_file, abs_file_path, "wordlist.txt"]
    stegseek_out = run_command(stegseek_cmd)
    
    # Remove branding
    stegseek_out = stegseek_out.replace("StegSeek 0.6 - https://github.com/RickdeJager/StegSeek", "")
    
    # Check if stegseek created an output file
    
    # Save the log output always
    log_result = save_output('steghide', stegseek_out)
    final_file_path = log_result['file_path'] # Default to log file if no extraction

    if os.path.exists(expected_out_file):
        # Determine file extension using 'file' command
        ext = ".bin"
        try:
            # Run file --mime-type -b <file>
            mime_cmd = ["file", "--mime-type", "-b", expected_out_file]
            mime_out = subprocess.check_output(mime_cmd).decode().strip()
            guessed_ext = mimetypes.guess_extension(mime_out)
            if guessed_ext:
                ext = guessed_ext
        except Exception as e:
            stegseek_out += f"\n[!] Warning: Could not detect file type: {e}"
        
        # normalize common extensions
        if ext == '.jpe': ext = '.jpg'
        
        extract_filename = f"steghide_extracted{ext}"
        final_extract_path = os.path.join(result_dir, extract_filename)
        
        shutil.move(expected_out_file, final_extract_path)
        final_file_path = f"{result_dir_name}/{extract_filename}"
        stegseek_out += f"\n[+] SUCCESS: Password found and data extracted to {extract_filename}!"
    else:
         stegseek_out += "\n[-] Bruteforce finished. If no success message above, password was not found in wordlist."

    results['steghide'] = {
        "content": stegseek_out,
        "file_path": final_file_path
    }
    
    # outguess (Needs explicit output file for data, but we capture stdout/info here)
    outguess_out_file = os.path.join(result_dir, "outguess.out")
    outguess_log = run_command(["outguess", "-r", abs_file_path, outguess_out_file])
    # Check if outguess produced a data file
    if os.path.exists(outguess_out_file):
        outguess_log += f"\n\n[INFO] Data extracted to {os.path.basename(outguess_out_file)}"
        results['outguess'] = {
            "content": outguess_log,
            "file_path": f"{result_dir_name}/{os.path.basename(outguess_out_file)}"
        }
    else:
        results['outguess'] = save_output('outguess', outguess_log)
    
    # exiftool
    exif_out = run_command(["exiftool", abs_file_path])
    results['exiftool'] = save_output('exiftool', exif_out)
    
    # binwalk
    # Run binwalk with extraction (-e) and signature scanning (-B is default)
    # We want to capture the log, but also allow extraction.
    # Note: binwalk extracts to a directory named _{filename}.extracted
    binwalk_cmd = ["binwalk", "-e", abs_file_path]
    binwalk_out = run_command(binwalk_cmd)
    
    # Check for extracted directory
    extracted_dir_name = f"_{filename}.extracted"
    extracted_full_path = os.path.join(base_dir, extracted_dir_name)
    
    if os.path.exists(extracted_full_path) and os.listdir(extracted_full_path):
        # Zip the extracted content
        zip_base_name = os.path.join(result_dir, "binwalk_extracted")
        shutil.make_archive(zip_base_name, 'zip', extracted_full_path)
        
        results['binwalk'] = {
            "content": binwalk_out + "\n\n[INFO] Files extracted and zipped.",
            "file_path": f"{result_dir_name}/binwalk_extracted.zip"
        }
        # Optionally cleanup the extraction folder to save space, but keeping it is fine for debug
    else:
        # Just return the log if nothing extracted
        results['binwalk'] = save_output('binwalk', binwalk_out)
    
    # foremost
    foremost_out_dir = os.path.join(result_dir, "foremost_out")
    run_command(["foremost", "-o", foremost_out_dir, "-i", abs_file_path])
    foremost_msg = f"Foremost output saved to directory: {os.path.basename(foremost_out_dir)}"
    # Zip the foremost output for easy download
    shutil.make_archive(foremost_out_dir, 'zip', foremost_out_dir)
    results['foremost'] = {
        "content": foremost_msg,
        "file_path": f"{result_dir_name}/foremost_out.zip"
    }
    
    # strings
    strings_out = run_command(["strings", "-n", "10", abs_file_path])
    results['strings'] = save_output('strings', strings_out)

    return {
        "file_path": file_path,
        "filename": filename,
        "bit_planes": bit_planes, # dictionary of "Label": "filename"
        "images_zip": images_zip_path,
        "tool_outputs": results,
        "result_dir": result_dir_name
    }
