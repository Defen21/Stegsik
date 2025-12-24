# Stegsik - Forensic Steganography Tool

Stegsik is a web-based forensic tool designed for analyzing, embedding, and recovering hidden data in images (Steganography). It supports both simple and advanced steganography techniques, including custom spacing algorithms and encryption.

## Features
- **Forensic Analysis**: Analyze images for hidden artifacts and metadata.
- **Steganography**: Hide and recover messages or files within cover images.
- **Encryption**: Secure images with XOR-based encryption.
- **Advanced Mode**: Use custom offsets and intervals for deeper concealment.

## Architecture
- **Frontend**: React (Vite)
- **Backend**: FastAPI (Python)
- **Database/Queue**: Redis & Celery for background processing
- **Containerization**: Docker & Docker Compose

## Prerequisites
- Docker & Docker Compose installed on your machine.

## How to Run
1. Clone the repository.
2. Ensure you have the wordlist file (see notes below).
3. Run the application:
   ```bash
   docker-compose up --build
   ```
4. Access the application:
   - **Frontend**: http://localhost:5173
   - **Backend API**: http://localhost:8000/docs

## Note on Resources
The file `backend/wordlist.txt` is required for dictionary attacks/analysis but is excluded from this repository due to size (>100MB). Please download a standard `rockyou.txt` or similar wordlist and place it at `backend/wordlist.txt`.
