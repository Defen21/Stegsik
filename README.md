# Stegsik - Advanced Forensic Steganography Tool

Stegsik is a powerful, web-based forensic toolkit designed for analyzing, embedding, and recovering hidden data in images. It combines standard forensic analysis with advanced steganography and encryption techniques, all wrapped in a modern, secure web interface.

## 🚀 Key Features

### 1. Deep Forensic Analysis
Automated analysis pipeline that runs multiple forensic tools on uploaded images.
- **Bit Plane Analysis**: Extracts and visualizes all 8 bit planes (R, G, B channels) to find hidden noise or patterns.
- **Metadata Extraction**: Uses `exiftool` to pull detailed file metadata.
- **File Carving**: Uses `foremost` and `binwalk` to verify file integrity and extract hidden files concatenated to the image.
- **Steganography Check**: Runs `zsteg`, `steghide`, and `outguess` to detect common hidden payloads.
- **Strings**: Extracts readable strings from binary data.

### 2. Magic Height Patcher
A specialized tool for PNG and JPG image recovery.
- **Problem**: Images are often cropped or hidden by manually altering the "Height" bytes in the file header, hiding the lower portion of the image.
- **Solution**: This tool allows you to manually inject new height values into the file header without corrupting the file structure, revealing the hidden footer.

### 3. RGB Scrambler (Image Encryption)
Hides visual information by mathematically shuffling pixel values.
- **Encryption**: Scrambles the RGB values of every pixel using a password-derived key (XOR-based). The result looks like random noise.
- **Decryption**: Reverses the process to losslessly recover the original image.
- **Security**: The output is always a valid PNG, making it look like a corrupted or noise image rather than an encrypted file container.

### 4. Basic Steganography (Embedder)
Simply hide data within standard images.
- **Embed Text/File**: Hide text messages or files (ZIP) inside a cover image.
- **Extraction**: Recover the hidden payload from the steganographic image.
- **Password Protection**: Optional password layer for added security.

### 5. Advanced Morse Steganography
A custom, high-security steganographic method.
- **Algorithm**: Hides messages by slightly altering pixel values at specific *intervals* starting from a specific *offset*.
- **Secret Keys**: Requires two private keys to recover the message:
    - `Start Offset`: The byte position where the message begins.
    - `Interval`: The step size between hidden bits.
- **Blind Recovery**: Without these two keys, the message is statistically indistinguishable from random image noise.

---

## 🛠 Architecture & Tech Stack
- **Frontend**: React (Vite) + TypeScript. Securely communicates with backend via Nginx.
- **Backend**: FastAPI (Python 3.9). Handles image processing and binary manipulation.
- **Worker**: Celery + Redis. Manages heavy forensic tasks asynchronously.
- **Infrastructure**: Docker & Docker Compose with Nginx Reverse Proxy.

---

## 🔒 Security Features
- **Force HTTPS**: All traffic is encrypted via SSL/TLS (Certbot).
- **Public API Blocked**: Direct access to API ports (8000/3000) is blocked by firewall and Docker binding.
- **Docs Disabled**: Swagger UI (`/docs`) is disabled in production to prevent information disclosure.
- **Path Protection**: Frontend automatically redirects unknown paths (`404`) to the root to prevent enumeration.

---

## 📦 Deployment Guide (VPS)

1. **Clone & Setup**
   ```bash
   git clone https://github.com/your-repo/stegsik.git
   cd stegsik
   ```

2. **Configuration**
   Ensure `docker-compose.yml` binds ports to `127.0.0.1` for security.

3. **Run Application**
   ```bash
   sudo docker-compose up -d --build
   ```

4. **SSL Setup (First Time Only)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d stegsik.xyz -d www.stegsik.xyz
   ```

5. **Access**
   Open `https://stegsik.xyz` in your browser.
