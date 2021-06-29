FROM public.ecr.aws/lts/ubuntu:20.04

ENV TZ="America/New_York"
ARG DEBIAN_FRONTEND=noninteractive

ADD ["https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie", "/usr/bin/aws-lambda-rie"]
RUN chmod +x /usr/bin/aws-lambda-rie

RUN apt-get update && apt-get install --no-install-recommends -y python3-pip python3 build-essential ffmpeg \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . .

RUN chmod +x entrypoint.sh

RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt
RUN pip3 install awslambdaric

RUN apt-get purge build-essential -y && apt-get autoremove -y

WORKDIR /
ENTRYPOINT [ "./entrypoint.sh" ]
CMD ["handler.handler"]
