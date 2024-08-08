import { RedisClientType, createClient } from "redis";

export class RedisClient {
  private static instance: RedisClient;
  public subscriber: RedisClientType;
  public publisher: RedisClientType;
  public subscriptions: Map<string, string[]>;
  public reverseSubscriptions: Map<
    string,
    { [userId: string]: { userId: string; ws: WebSocket } }
  >;

  // subscriptions => {user1: [room1, room2], user2: [room3, room1], ...}
  // reverseSubscriptions => {
  //    room1: {
  //      user1: {user1, ws1},
  //      user2: {user2, ws2},
  //      user3: {user3, ws3},
  //      ...
  //    },
  //    room2: {
  //      user6: {user6, ws6},
  //      user2: {user2, ws2},
  //    }
  //    ...
  // }

  private constructor() {
    this.subscriber = createClient();
    this.publisher = createClient();
    this.subscriber.connect();
    this.publisher.connect();
    this.subscriptions = new Map<string, string[]>();
    this.reverseSubscriptions = new Map<
      string,
      { [userId: string]: { userId: string; ws: WebSocket } }
    >();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new RedisClient();
    }
    return this.instance;
  }

  subscribe(userId: string, room: string, ws: any) {}

  unsubscribe(userId: string, roomToUnsubscribe: string) {}

  publish(room: string, message: any) {}
}
