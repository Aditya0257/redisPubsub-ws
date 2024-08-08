import { WebSocket } from "ws";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import { RedisClient } from "./subscriber";

const server = http.createServer(function (request: any, response: any) {
  console.log(new Date() + " Received request for " + request.url);
  response.end("hi there");
});

const wss = new WebSocket.Server({ server });

const users: {
  [key: string]: {
    room: string;
    ws: any;
  };
} = {};

wss.on("connection", async function connection(ws) {
  ws.on("error", (error) => {
    console.error(error);
  });

  // When a WebSocket connection is first established, the server sets up a context for that specific connection.
  // This is where we generate the id and perform any other initialization tasks.
  // Anything we define outside of the ws.on("message") block, but within the wss.on('connection', ...) block,
  // persists for the entire duration of that WebSocket connection.

  const id = uuidv4(); // Persisted for this connection
  console.log("client connected");

  ws.on("message", function incoming(message) {
    const data = JSON.parse(message.toString());
    if (data.type === "join") {
      // The user is joining for the first time. We generate a unique `id` for this user
      // and store their WebSocket connection and room information in Node.js's in-memory data.
      users[id] = {
        room: data.payload.roomId,
        ws,
      };
      // If this is the first user in the specified room, the WebSocket server subscribes to that room in Redis.
      // This subscription call is made only once when the first user joins the room.
      // The server remains subscribed to that room until the connection is closed or the last user leaves.
      RedisClient.getInstance().subscribe(id, data.payload.roomId, ws);
    } else if (data.type === "message") {
      // When a user sends a message, we retrieve their stored `id` and use it to find which room they are in.
      // We then publish the message to that room via Redis Pub/Sub.
      // The RedisClient handles sending the message to all WebSocket connections subscribed to that room.
      const roomId = users[id].room;
      const message = data.payload.message;
      RedisClient.getInstance().publish(roomId, message);
    }
  });

  ws.send(`Hello! Message from WS Server!!. id is ${id}`);

  ws.on("close", function () {
    console.log("Client disconnected");
    RedisClient.getInstance().unsubscribe(id, users[id].room);
  });
});

server.listen(8080, () => {
  console.log(new Date() + " Server is listening on port 8080");
});
