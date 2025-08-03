import {
    FilesetResolver,
    HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

const video = document.getElementById("webcam");
const signName = document.getElementById("signName");
const startCameraButton = document.getElementById("startCameraButton");
const startRecordingButton = document.getElementById("startRecordingButton");
const stopRecordingButton = document.getElementById("stopRecordingButton");
const landmarkCanvas = document.getElementById("landmarkCanvas");
const context = landmarkCanvas.getContext("2d");

let continueRecording = false;

let currentSigns = [];

window.startCamera = function () {
    // ask for webcam access
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(async stream => {

            // turn on video
            video.srcObject = stream;
            startCameraButton.disabled = true;

            // turn on vision and tracking

            // create task
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
            );

            const handLandmarker = await HandLandmarker.createFromOptions(
                vision,
                {
                    baseOptions: {
                        modelAssetPath: "hand_landmarker.task"
                    },
                    numHands: 2
                });

            // run task
            await handLandmarker.setOptions({ runningMode: "video" });

            // this tracks where in the video we are, -1 to start
            let lastVideoTime = -1;

            // start detection loop
            detectionLoop();

            function detectionLoop() {
                // check if the video has advanced since last time
                if (video.currentTime !== lastVideoTime) {
                    // get hand data
                    const detections = handLandmarker.detectForVideo(video, performance.now());
                    processDetections(detections);

                    // update video time
                    lastVideoTime = video.currentTime;
                }

                requestAnimationFrame(() => {
                    detectionLoop();
                });
            }
        })
        .catch(err => {
            alert("Error accessing webcam: " + err);
        });
}

window.startRecording = async function () {
    // enable and disable ui elements
    signName.disabled = true;
    startRecordingButton.disabled = true;
    stopRecordingButton.disabled = false;

    // clear signs
    currentSigns = [];

    // this will start recording
    continueRecording = true;
}

function processDetections(detections) {
    // if we're recording, save the detections
    if (continueRecording) {
        saveDetections();
    }

    // draw detections

    // clear canvas
    context.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);

    // loop through landmarks and draw them
    for (let i = 0; i < detections.landmarks.length; i++) {
        const currentLandmarks = detections.landmarks[i];

        drawConnectors(context, currentLandmarks, HAND_CONNECTIONS, {
            color: "#00FF00",
            lineWidth: 5
        });

        drawLandmarks(context, currentLandmarks, { color: "#FF0000", lineWidth: 2 });
    }
}


function saveDetections(detections) {
    // push new landmarks
    currentSigns.push(
        {
            signName: signName.value,
            detections: detections.worldLandmarks
        });
}

window.stopRecording = function () {
    // stop recording
    continueRecording = false;

    // disable ui elements
    signName.disabled = false;
    stopRecordingButton.disabled = true;
    startRecordingButton.disabled = false;

    console.log(currentSigns);

    // save sign data as json
    const jsonStr = JSON.stringify(currentSigns);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // create download link
    const a = document.createElement("a");
    a.href = url;
    a.download = signName.value + ".json";
    a.click();

    // clean up url object
    URL.revokeObjectURL(url);
}