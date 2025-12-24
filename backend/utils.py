import struct
import os
import numpy as np
import hashlib
from PIL import Image

def patch_png_height(file_path, new_height):
    """
    Patches the IHDR chunk of a PNG file with a new height.
    """
    try:
        with open(file_path, 'r+b') as f:
            # Check PNG signature
            sig = f.read(8)
            if sig != b'\x89PNG\r\n\x1a\n':
                return False, "Not a valid PNG file"

            # IHDR should be the first chunk
            # Chunk structure: Length (4), Type (4), Data (Length), CRC (4)
            
            # Read IHDR chunk length (should be 13)
            length = struct.unpack('>I', f.read(4))[0]
            chunk_type = f.read(4)
            
            if chunk_type != b'IHDR':
                return False, "IHDR chunk not found at expected location"
            
            # IHDR Data: Width (4), Height (4), ...
            # Move cursor to Height (Current pos is 16: 8 sig + 4 len + 4 type)
            # Width is next 4 bytes. Height is after that.
            f.seek(4, 1) # Skip width
            
            # Write new height (4 bytes, big-endian)
            f.write(struct.pack('>I', int(new_height)))
            
            # Note: Changing data invalidates CRC. Ideally we should split IHDR and recalculate CRC.
            # However, many viewers (and browsers) ignore IHDR CRC or warn but show it.
            # To be correct, we should recalculate CRC for IHDR.
            
            # Let's verify if we want to fix CRC. 
            # IHDR data is 13 bytes: Width(4), Height(4), BitDepth(1), ColorType(1), Comp(1), Filter(1), Interlace(1)
            # We need to read the whole IHDR data to calc CRC.
            
            # Rewind to IHDR data start (Type + Data)
            f.seek(12) # 8 sig + 4 len
            chunk_type_and_data = f.read(4 + 13) # Type(4) + Data(13)
            
            import zlib
            new_crc = zlib.crc32(chunk_type_and_data)
            f.write(struct.pack('>I', new_crc))
            
            return True, "PNG height patched successfully"
    except Exception as e:
        return False, str(e)

def patch_jpg_height(file_path, new_height):
    """
    Patches SOF0/SOF2 markers in a JPG file.
    """
    try:
        with open(file_path, 'r+b') as f:
            f.seek(0)
            if f.read(2) != b'\xff\xd8':
                return False, "Not a valid JPEG file"
            
            while True:
                marker = f.read(2)
                if not marker:
                    break
                
                # Markers start with 0xFF
                while marker[0] != 0xFF:
                    marker = f.read(2) # Try to resync? Or just 1 byte?
                    # Strict JPEG parsing usually doesn't need search, but robust might.
                    # Let's assume valid structure.
                    if not marker: return False, "Unexpected end of file"

                marker_code = marker[1]
                
                # Standalone markers (no length)
                if marker_code in [0x01, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9]:
                    continue
                
                # Markers with payload
                length_bytes = f.read(2)
                if not length_bytes: break
                length = struct.unpack('>H', length_bytes)[0]
                
                # SOF0 (Baseline) = 0xC0, SOF2 (Progressive) = 0xC2
                if marker_code in [0xC0, 0xC2]:
                    # SOF Structure: Precision(1), Height(2), Width(2), ...
                    f.read(1) # Precision
                    
                    # Overwrite Height
                    f.write(struct.pack('>H', int(new_height)))
                    return True, "JPG height patched successfully"
                
                # Skip payload of other segments
                # We already read 2 bytes of length. Payload size is length - 2.
                f.seek(length - 2, 1)
                
            return False, "SOF marker not found"
            
    except Exception as e:
        return False, str(e)

def process_image_encryption(file_path, password, mode='encrypt'):
    """
    Encrypts or decrypts an image using XOR with a specific password-derived key.
    Output is always PNG to allow lossless restoration.
    """
    try:
        # Open image and convert to RGB (ensure consistent channels)
        img = Image.open(file_path).convert('RGB')
        img_array = np.array(img)
        
        # Derive key from password
        # Use SHA-256 to get a deterministic hash
        key_hash = hashlib.sha256(password.encode()).digest()
        
        # Convert hash to an integer seed for NumPy
        # int.from_bytes is a standard way to convert bytes to int
        seed = int.from_bytes(key_hash, 'big') % (2**32 - 1) # Numpy seed must be uint32
        
        # Create a RandomState with the seed for reproducibility
        # We use RandomState instead of default_rng for legacy consistency if needed, 
        # but default_rng is better. Let's use RandomState for simplicity in seeding.
        rng = np.random.RandomState(seed)
        
        # Generate random noise (key stream) with same shape as image
        # Integers between 0-255 (byte size)
        key_stream = rng.randint(0, 256, list(img_array.shape), dtype=np.uint8)
        
        # XOR operation (Symmetric: A ^ B = C, C ^ B = A)
        # So encrypt and decrypt logic is identical
        result_array = np.bitwise_xor(img_array, key_stream)
        
        result_img = Image.fromarray(result_array)
        
        # Save as PNG
        dir_name = os.path.dirname(file_path)
        base_name = os.path.basename(file_path)
        name_without_ext = os.path.splitext(base_name)[0]
        
        if mode == 'encrypt':
            out_filename = f"encrypted_{name_without_ext}.png"
        else:
            out_filename = f"decrypted_{name_without_ext}.png"
            
        out_path = os.path.join(dir_name, out_filename)
        
        # Preserve Metadata
        # We need to construct a PngInfo object for PNG-specific metadata
        from PIL.PngImagePlugin import PngInfo
        png_info = PngInfo()
        
        # Copy existing info
        # Note: 'exif' and 'icc_profile' are handled as parameters to save(), 
        # but other text chunks might be in img.info
        
        save_kwargs = {'format': 'PNG'}
        
        if 'exif' in img.info:
            save_kwargs['exif'] = img.info['exif']
            
        if 'icc_profile' in img.info:
            save_kwargs['icc_profile'] = img.info['icc_profile']
            
        # Add other textual info to png_info
        # Pillow's img.info often contains various keys. 
        # For PNG, standard keys are often added to PngInfo automatically if passed to pnginfo arg?
        # Actually, img.info might contain 'dpi', 'compression', etc. 
        # We want to preserve text chunks primarily.
        
        for k, v in img.info.items():
            if isinstance(k, str) and isinstance(v, str):
                # Simple text chunks
                png_info.add_text(k, v)
                
        save_kwargs['pnginfo'] = png_info
        
        result_img.save(out_path, **save_kwargs)
        
        # Restore Overlay/Embedded files if any
        overlay_data = extract_overlay(file_path)
        
        # --- PASSWORD VERIFICATION LOGIC ---
        MAGIC_SIG = b'RGB_SIG'
        
        if mode == 'encrypt':
            # Create Signature: MAGIC + Salt(16) + Hash(32)
            salt = os.urandom(16)
            verifier = hashlib.sha256(password.encode() + salt).digest()
            signature = MAGIC_SIG + salt + verifier
            
            # Prepend to existing overlay (if any)
            final_overlay = signature + (overlay_data if overlay_data else b'')
            
            with open(out_path, 'ab') as f:
                f.write(final_overlay)
                
        else: # decrypt
            # Check for Signature in overlay_data
            is_legacy = True
            actual_overlay = overlay_data
            
            if overlay_data and len(overlay_data) >= 55: # 7+16+32
                if overlay_data.startswith(MAGIC_SIG):
                    is_legacy = False
                    # Extract parts
                    salt = overlay_data[7:23] # 16 bytes
                    stored_verifier = overlay_data[23:55] # 32 bytes
                    actual_overlay = overlay_data[55:] # The rest
                    
                    # Verify
                    check = hashlib.sha256(password.encode() + salt).digest()
                    
                    if check != stored_verifier:
                         # Use the EXACT error message requested by user
                         return False, "Error: Could not recover message. Invalid Key (Offset/Interval) or corrupted data.", None

            # If verified (or legacy), write the rest of overlay
            if actual_overlay:
                with open(out_path, 'ab') as f:
                    f.write(actual_overlay)
        
        return True, out_filename, out_path
        
    except Exception as e:
        return False, str(e), None

def extract_overlay(file_path):
    """
    Extracts any data appended to the end of a PNG or JPG file.
    """
    try:
        with open(file_path, 'rb') as f:
            data = f.read()
            
        # 1. Check for PNG IEND chunk
        # IEND chunk signature: len(00 00 00 00) + 'IEND' + CRC(4 bytes) = 12 bytes total
        # Hex: 00 00 00 00 49 45 4E 44 AE 42 60 82
        png_iend = b'\x00\x00\x00\x00IEND\xae\x42\x60\x82'
        
        iend_pos = data.rfind(png_iend)
        if iend_pos != -1:
            # Overlay is everything after IEND chunk (12 bytes long)
            overlay_start = iend_pos + 12
            if overlay_start < len(data):
                return data[overlay_start:]
        
        # 2. Check for JPG EOI marker
        # EOI is FF D9
        # Note: Scannning from end is safer, but images might have thumbnails.
        # Simple heuristic: The LAST FF D9 in the file.
        # WARNING: False positives possible if payload contains FF D9. 
        # But for simple appending, this works consistent with steganography tools.
        
        # We assume the file is a valid image followed by overlay
        
        # Let's check signature to determine logic
        if data.startswith(b'\x89PNG'):
            # Already checked PNG logic above
            return None
        elif data.startswith(b'\xff\xd8'):
             eoi = b'\xff\xd9'
             eoi_pos = data.rfind(eoi)
             if eoi_pos != -1:
                 overlay_start = eoi_pos + 2
                 if overlay_start < len(data):
                     return data[overlay_start:]
    
    except Exception:
        pass
    
    return None

import subprocess
import uuid

def embed_data(cover_path, payload_bytes, output_path):
    """
    Appends payload bytes to the end of the cover image.
    """
    try:
        with open(cover_path, 'rb') as f_cover:
            cover_data = f_cover.read()
            
        with open(output_path, 'wb') as f_out:
            f_out.write(cover_data)
            f_out.write(payload_bytes)
            
        return True, "Data embedded successfully"
    except Exception as e:
        return False, str(e)


