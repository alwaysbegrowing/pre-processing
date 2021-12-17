import cv2

scale_factor = 1.2
min_neighbors = 3
min_size = (50, 50)

async def detect_faces(frame_path):
    frame = cv2.imread(frame_path)
    if frame is None:
        return []
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier('data/haarcascade/haarcascade_frontalface_alt2.xml')
    faces = cascade.detectMultiScale(gray, scaleFactor=scale_factor, minNeighbors=min_neighbors, minSize=min_size)
    return faces
