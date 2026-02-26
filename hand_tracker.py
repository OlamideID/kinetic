import asyncio
import json
import cv2
import mediapipe as mp
import websockets

# ── MediaPipe setup ────────────────────────────────────────────────────────────
mp_hands = mp.solutions.hands
mp_draw  = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.6,
)

# ── Gesture detection ──────────────────────────────────────────────────────────
def detect_gesture(landmarks):
    """
    Improved open/closed detection.
    Measures distance from each fingertip to the wrist.
    When fist is closed, fingertips are much closer to wrist than when open.
    This is more reliable than tip-vs-pip y comparison alone.
    """
    wrist = landmarks[0]

    # Fingertip landmark IDs
    tips = [4, 8, 12, 16, 20]
    # Middle knuckle (MCP) landmark IDs — reference for "extended" distance
    mcps = [2, 5, 9, 13, 17]

    tip_distances  = []
    mcp_distances  = []

    for tip_id, mcp_id in zip(tips, mcps):
        tip = landmarks[tip_id]
        mcp = landmarks[mcp_id]

        td = ((tip.x - wrist.x)**2 + (tip.y - wrist.y)**2) ** 0.5
        md = ((mcp.x - wrist.x)**2 + (mcp.y - wrist.y)**2) ** 0.5

        tip_distances.append(td)
        mcp_distances.append(md)

    # If average tip distance < average mcp distance * threshold → closed fist
    avg_tip = sum(tip_distances) / len(tip_distances)
    avg_mcp = sum(mcp_distances) / len(mcp_distances)

    # Threshold tuned: tips curled in when ratio < 1.15
    if avg_tip < avg_mcp * 1.15:
        return "closed"

    # Secondary check: count extended fingers (tip above pip on y-axis)
    finger_pairs = [(8, 6), (12, 10), (16, 14), (20, 18)]
    extended = sum(1 for tip, pip in finger_pairs if landmarks[tip].y < landmarks[pip].y)

    return "open" if extended >= 1 else "closed"


def get_hand_center(landmarks, frame_w, frame_h):
    """Midpoint of wrist (0) and middle-finger MCP (9)."""
    cx = (landmarks[0].x + landmarks[9].x) / 2
    cy = (landmarks[0].y + landmarks[9].y) / 2
    return round(cx, 4), round(cy, 4)


# ── Shared state ───────────────────────────────────────────────────────────────
latest_data = {"x": 0.5, "y": 0.5, "gesture": "open", "detected": False}
connected_clients = set()

# ── WebSocket ─────────────────────────────────────────────────────────────────
async def handler(websocket):
    connected_clients.add(websocket)
    print(f"[WS] Client connected. Total: {len(connected_clients)}")
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f"[WS] Client disconnected. Total: {len(connected_clients)}")

async def broadcast_loop():
    while True:
        if connected_clients:
            msg = json.dumps(latest_data)
            await asyncio.gather(
                *[ws.send(msg) for ws in connected_clients],
                return_exceptions=True,
            )
        await asyncio.sleep(1 / 60)

def capture_loop():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[CAM] ERROR: Cannot open webcam.")
        return

    print("[CAM] Webcam opened. Press Q to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = hands.process(rgb)

        if result.multi_hand_landmarks:
            lm      = result.multi_hand_landmarks[0].landmark
            cx, cy  = get_hand_center(lm, w, h)
            gesture = detect_gesture(lm)

            latest_data.update(x=cx, y=cy, gesture=gesture, detected=True)

            mp_draw.draw_landmarks(
                frame,
                result.multi_hand_landmarks[0],
                mp_hands.HAND_CONNECTIONS,
            )
            color = (0, 220, 80) if gesture == "open" else (0, 40, 220)
            cv2.putText(frame, f"{gesture.upper()}", (10, 38),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
            cv2.putText(frame, f"x:{cx:.2f}  y:{cy:.2f}", (10, 72),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (200, 200, 200), 1)
        else:
            latest_data["detected"] = False
            cv2.putText(frame, "No hand", (10, 38),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (80, 80, 80), 2)

        cv2.imshow("Hand Tracker  —  Q to quit", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

# ── Main ───────────────────────────────────────────────────────────────────────
async def main():
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, capture_loop)
    print("[WS] ws://localhost:6789  —  open index.html via python -m http.server 8000")
    async with websockets.serve(handler, "localhost", 6789):
        await broadcast_loop()

if __name__ == "__main__":
    asyncio.run(main())

  