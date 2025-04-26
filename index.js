import {
    FilesetResolver,
    HandLandmarker
  } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

const video = document.getElementById("webcam");
const signName = document.getElementById("signName");

let continueRecording = false;

let currentSigns = [];

window.startCamera = function() {
    // ask for webcam access
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        video.srcObject = stream;
      })
      .catch(err => {
        console.error("Error accessing webcam:", err);
      });
}

window.startRecording = async function() {
    currentSigns = [];
    signName.disabled = true; 
    
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

    let lastVideoTime = -1;

    function renderLoop() {
        // stop recording if needed
        if (!continueRecording){
            return;
        }

        if (video.currentTime !== lastVideoTime) {
            // get hand data
            const detections = handLandmarker.detectForVideo(video, performance.now());
            processResults(detections);
            lastVideoTime = video.currentTime;
        }

        requestAnimationFrame(() => {
            renderLoop();
        });
    }

    continueRecording = true;
    renderLoop();
}

function processResults(detections){
    currentSigns.push(
    {
        signName: signName.value,
        detections: detections
    });
}

window.stopRecording = function() {
    continueRecording = false;
    signName.disabled = false;

    console.log(currentSigns);

    // save sign data as 
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