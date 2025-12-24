FROM python:3.9-slim-buster

# Install system dependencies and forensic tools
# Fix for archived Debian Buster repositories
RUN echo "deb http://archive.debian.org/debian buster main" > /etc/apt/sources.list \
    && echo "deb http://archive.debian.org/debian-security buster/updates main" >> /etc/apt/sources.list \
    && apt-get -o Acquire::Check-Valid-Until=false update && apt-get install -y \
    ruby \
    ruby-dev \
    steghide \
    outguess \
    exiftool \
    binwalk \
    foremost \
    libimage-exiftool-perl \
    binutils \
    unzip \
    p7zip-full \
    gcc \
    make \
    wget \
    zlib1g-dev \
    libjpeg-dev \
    libmhash-dev \
    libmcrypt-dev \
    file \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Install Stegseek
RUN wget --no-check-certificate https://github.com/RickdeJager/stegseek/releases/download/v0.6/stegseek_0.6-1.deb \
    && apt-get update && apt-get install -y ./stegseek_0.6-1.deb \
    && rm stegseek_0.6-1.deb

# Install zsteg using gem
RUN gem install zsteg


WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
