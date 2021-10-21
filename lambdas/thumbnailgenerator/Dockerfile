# FFMPEG and Python 3.9 on Debian 11
FROM ghcr.io/pillargg/ffmpeg-lambda-base:latest

COPY . .
RUN chmod +x ./entrypoint.sh

RUN pip3 install --no-cache-dir --upgrade pip
RUN pip3 install --no-cache-dir -r requirements.txt

WORKDIR /
ENTRYPOINT [ "./entrypoint.sh" ]
CMD ["handler.handler"]
