FROM ghcr.io/pillargg/opencv-python-base:latest

WORKDIR /app

COPY . .

RUN chmod +x ./entrypoint.sh

# run pip install 
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

ENTRYPOINT [ "./entrypoint.sh" ]
CMD ["handler.handler"]
