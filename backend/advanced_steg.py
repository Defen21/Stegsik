import os
import binascii

# --- KONFIGURASI CONSTANTS for Defaults ---
DEFAULT_INTERVAL = 50 
DEFAULT_START_OFFSET = 1024 

# --- KAMUS MORSE STANDAR ---
MORSE_DICT = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--', 
    '4': '....-', '5': '.....', '6': '-....', '7': '-...', '8': '---..', 
    '9': '----.', '0': '-----', ' ': '/', '_': '..--.-', '{': '-.--.', 
    '}': '-.--.-', '?': '..--..'
}

MORSE_DICT_REVERSE = {v: k for k, v in MORSE_DICT.items()}
# Fix mapping for numbers/symbols that might have been overwritten if any duplicates exist (unlikely in morse but good practice)
# Also need to ensure lower case mapping for reverse if needed, but the logic handles upper.
# Actually the prompt had a specific reverse dict, let's copy that to be safe.
MORSE_DICT_REVERSE = {
    '.-': 'a', '-...': 'b', '-.-.': 'c', '-..': 'd', '.': 'e', '..-.': 'f',
    '--.': 'g', '....': 'h', '..': 'i', '.---': 'j', '-.-': 'k', '.-..': 'l',
    '--': 'm', '-.': 'n', '---': 'o', '.--.': 'p', '--.-': 'q', '.-.': 'r',
    '...': 's', '-': 't', '..-': 'u', '...-': 'v', '.--': 'w', '-..-': 'x',
    '-.--': 'y', '--..': 'z', '.----': '1', '..---': '2', '...--': '3', 
    '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8', 
    '----.': '9', '-----': '0', '..--.-': '_', '-.--.': '{', '-.--.-': '}', 
    '..--..': '?'
}


# --- ATURAN KHUSUS (NON-STANDAR) ---
CAP_MARKER = '......' # Jika muncul ini, huruf berikutnya Kapital
TERMINATOR = '__EOS__' # End of Stream Marker to stop garbage decoding

def generate_noise(length):
    return os.urandom(length)

def text_to_custom_bytes_sensitive(text):
    print("[*] Mengonversi teks dengan aturan Case Sensitive...")
    morse_seq = []
    
    for char in text:
        # Cek apakah huruf kapital (A-Z)
        if char.isupper():
            # Tambahkan Marker Kapital dulu
            morse_seq.append(CAP_MARKER)
            # Lalu tambahkan kode hurufnya
            morse_seq.append(MORSE_DICT[char])
            
        # Cek apakah huruf kecil (a-z)
        elif char.islower():
            # Langsung tambahkan kodenya (tanpa marker = lowercase)
            morse_seq.append(MORSE_DICT[char.upper()])
            
        # Angka dan Simbol
        elif char.upper() in MORSE_DICT:
             morse_seq.append(MORSE_DICT[char.upper()])
        
        # Handle unknown chars logic? Original code just ignores them or fails. 
        # We will ignore based on the loop.
            
    full_morse = ' '.join(morse_seq) + ' '
    
    # Mapping ke Binary Custom: .->00, ->01, spasi->10
    bits = ""
    for char in full_morse:
        if char == '.': bits += "00"
        elif char == '-': bits += "01"
        elif char in [' ', '/']: bits += "10"
        
    # Padding bits agar kelipatan 8
    while len(bits) % 8 != 0:
        bits += "0"
        
    byte_data = bytearray()
    for i in range(0, len(bits), 8):
        byte_data.append(int(bits[i:i+8], 2))
        
    return byte_data

def find_eoi(data):
    """Finds the End of Image (EOI) offset for JPG or PNG."""
    jpg_eoi = data.rfind(b'\xFF\xD9')
    png_iend = data.rfind(b'IEND')
    eoi = -1
    offset_cleanup = 0
    
    if jpg_eoi != -1:
        if data.startswith(b'\xFF\xD8'):
            eoi = jpg_eoi
            offset_cleanup = 2 # FF D9 is 2 bytes
            
    if eoi == -1 and png_iend != -1:
         if data.startswith(b'\x89PNG'):
            eoi = png_iend
            # IEND chunk structure: Length (4) + Type (4) + CRC (4)
            # rfind points to 'I' of IEND.
            # We need to skip IEND (4) + CRC (4) = 8 bytes.
            offset_cleanup = 8 

    return eoi, offset_cleanup

def custom_inject(original_data, message, start_offset, interval):
    # Detect File End to trim any existing junk/previous injection
    eoi, offset_cleanup = find_eoi(original_data)
    
    if eoi != -1:
        # Trim original data to EXACTLY the end of image
        valid_end = eoi + offset_cleanup
        print(f"[*] Trimming original data from {len(original_data)} to {valid_end} bytes.")
        original_data = original_data[:valid_end]
    else:
        print("[!] Warning: Could not detect valid image end. Appending to EOF.")

    # Generate Payload with Terminator
    full_message = message + TERMINATOR
    flag_bytes = text_to_custom_bytes_sensitive(full_message)
    print(f"[*] Panjang Payload (inc. EOS): {len(flag_bytes)} bytes")
    
    # Proses Injeksi (Needle in Haystack)
    injection_payload = bytearray()
    
    # Append noise and data
    injection_payload.extend(generate_noise(start_offset))
    
    for b in flag_bytes:
        injection_payload.append(b)
        injection_payload.extend(generate_noise(interval))
        
    final_data = original_data + injection_payload
    return final_data

def decode_binary_chunks(binary_str):
    res = ""
    # Baca per 2 bit: 00=., 01=-, 10=spasi
    for i in range(0, len(binary_str), 2):
        chunk = binary_str[i:i+2]
        if chunk == "00": res += "."
        elif chunk == "01": res += "-"
        elif chunk == "10": res += " "
    return res

def decode_custom_logic(morse_code_string):
    words = morse_code_string.split(' ') # Split berdasarkan spasi (kode 10)
    decoded_chars = []
    
    next_is_upper = False # Status shift key
    
    for code in words:
        if code == CAP_MARKER:
            # Jika ketemu marker, set flag kapital untuk huruf selanjutnya
            next_is_upper = True
            continue 
            
        if code in MORSE_DICT_REVERSE:
            char = MORSE_DICT_REVERSE[code]
            
            # Jika status kapital aktif, ubah huruf ini jadi besar
            if next_is_upper:
                char = char.upper()
                next_is_upper = False # Reset flag
            
            decoded_chars.append(char)
        else:
            if code == '/': 
                decoded_chars.append(' ')
                
    return "".join(decoded_chars)

def solve_custom_steg(data, start_offset, interval):
    # Detect File Type and Offset using helper
    eoi, offset_cleanup = find_eoi(data)
    
    if eoi == -1:
        return "Error: Could not detect valid End-of-Image marker (JPG or PNG)."

    if eoi == -1:
        return "Error: Could not detect valid End-of-Image marker (JPG or PNG)."
    
    hidden_data = data[eoi+offset_cleanup:]
    
    if len(hidden_data) < start_offset:
         return "Error: No hidden data found (file too small after EOI)."

    # Ekstrak Byte (De-obfuscate)
    payload_bytes = bytearray()
    curr = start_offset
    
    # Safely extract
    while curr < len(hidden_data):
        payload_bytes.append(hidden_data[curr])
        curr += (interval + 1)
        
    # Bytes ke Binary String
    bin_str = ""
    for b in payload_bytes:
        bin_str += format(b, '08b')
        
    # Binary ke Morse
    morse_str = decode_binary_chunks(bin_str)
    
    # Morse ke Text (Logic Kapital)
    decoded_text = decode_custom_logic(morse_str)
    
    # Check for Terminator
    if TERMINATOR in decoded_text:
        final_msg = decoded_text.split(TERMINATOR)[0]
        return final_msg
    else:
        # Strict mode: If terminator not found, it means keys are likely wrong
        return "Error: Could not recover message. Invalid Key (Offset/Interval) or corrupted data."
