"use client";

import { useEffect, useRef, useState } from "react";

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import Script from "next/script";

export default function Page() {
	const [signName, setSignName] = useState("");

	// enable/disable input
	const [startCameraDisabled, setStartCameraDisabled] = useState(false);
	const [stopCameraDisabled, setStopCameraDisabled] = useState(true);
	const [startRecordingDisabled, setStartRecordingDisabled] = useState(true);
	const [stopRecordingDisabled, setStopRecordingDisabled] = useState(true);
	const [nameDisabled, setNameDisabled] = useState(false);

	// elements
	const video = useRef(null);
	const canvas = useRef(null);
	const context = useRef(null);
	const nameInput = useRef(null);

	// video data
	let stream = useRef(null);
	let record = useRef(false);

	let recordedSigns = useRef([]);

	// get canvas context
	useEffect(() => {
		if (canvas.current) {
			context.current = canvas.current.getContext("2d");
		}
	}, [canvas]);

	return (
		<main>
			<Script type="module" src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js" crossOrigin="anonymous" />
			<Script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" crossOrigin="anonymous" />
			<Script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js" crossOrigin="anonymous" />

			<section>
				<h1>Sign Data Generator</h1>

				<p>Enter the name of a sign and perform it in different ways. When you are done, stop recording to download a JSON file of the hand landmark data for that sign.</p>

				<br />
				<br />

				<input placeholder="Sign Name" value={signName} onChange={(event) => setSignName(event.target.value)} disabled={nameDisabled}></input>

				<br />
				<br />

				<div style={{ display: "flex", gap: "10px" }}>
					<button onClick={startCamera} disabled={startCameraDisabled}>Start Camera</button>
					<button onClick={stopCamera} disabled={stopCameraDisabled}>Stop Camera</button>
					<button onClick={startRecording} disabled={startRecordingDisabled}>Start Recording Hand Landmarks</button>
					<button onClick={stopRecording} disabled={stopRecordingDisabled}>Stop Recording Hand Landmarks</button>
				</div>

				<div style={{ position: "relative", width: "640px", height: "480px" }}>
					<video
						ref={video}
						autoPlay
						playsInline
						style={{ position: "absolute", top: 0, left: 0 }}
						width="640"
						height="480"
					></video>

					<canvas
						ref={canvas}
						style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
						width="640"
						height="480"
					></canvas>
				</div>
			</section>
		</main>
	);

	function startCamera() {
		// ask for webcam access
		navigator.mediaDevices.getUserMedia({ video: true, audio: false })
			.then(async newStream => {
				// update ui elements
				setStartCameraDisabled(true);
				setStopCameraDisabled(false);
				setStartRecordingDisabled(false);

				// set stream globally
				stream.current = newStream;

				// turn on video
				video.current.srcObject = stream.current;

				// turn on vision and tracking

				// create task
				const vision = await FilesetResolver.forVisionTasks(
					"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
				);

				const handLandmarker = await HandLandmarker.createFromOptions(
					vision,
					{
						baseOptions: {
							modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
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
					// stop if the stream was deleted
					if (!stream.current) {
						return;
					}

					// check if the video has advanced since last time
					if (video.current.currentTime !== lastVideoTime) {
						// get hand data
						const detections = handLandmarker.detectForVideo(video.current, performance.now());
						processDetections(detections);

						// update video time
						lastVideoTime = video.current.currentTime;
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

	function processDetections(detections) {
		// if we're recording, save the detections
		if (record.current) {
			// push new landmarks
			recordedSigns.current.push(
				{
					signName: signName,
					worldLandmarks: detections.worldLandmarks
				});
		}

		// draw detections

		// clear canvas
		context.current.clearRect(0, 0, canvas.current.width, canvas.current.height);

		// loop through landmarks and draw them
		for (let i = 0; i < detections.landmarks.length; i++) {
			let currentLandmarks = detections.landmarks[i];

			// for some reason, the landmarks have a visibility property that's always 0 and hides them
			currentLandmarks = currentLandmarks.map(({ x, y, z }) => ({ x, y, z }));

			drawConnectors(context.current, currentLandmarks, HAND_CONNECTIONS, {
				color: "#00FF00",
				lineWidth: 2
			});

			drawLandmarks(context.current, currentLandmarks, { color: "#FF0000", lineWidth: 2 });
		}
	}

	function stopCamera() {
		// stop recording if recording
		if (record.current) {
			stopRecording();
		}

		// stop stream and delete variable
		stream.current.getTracks().forEach(track => track.stop());
		stream.current = null;

		// clear canvas
		context.current.clearRect(0, 0, canvas.current.width, canvas.current.height);

		// update ui elements
		setStartCameraDisabled(false);
		setStopCameraDisabled(true);
		setStartRecordingDisabled(true);
	}

	function startRecording() {
		// update ui elements
		setStartRecordingDisabled(true);
		setStopRecordingDisabled(false);
		setNameDisabled(true);

		// clear old signs
		recordedSigns.current = [];

		// start recording
		record.current = true;
	}

	function stopRecording() {
		// start recording
		record.current = false;

		// update ui elements
		setStopRecordingDisabled(true);
		setStartRecordingDisabled(false);
		setNameDisabled(false);

		console.log("Recorded: " + signName);
		console.log(recordedSigns.current);

		// download sign data

		// save sign data as json
		const jsonStr = JSON.stringify(recordedSigns.current);
		const blob = new Blob([jsonStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		// create download link
		const a = document.createElement("a");
		a.href = url;
		a.download = signName + ".json";
		a.click();

		// clean up url object
		URL.revokeObjectURL(url);
	}
}