import { joinRoom, Room } from "trystero/nostr";

const trysteroAppId = "zensu";
const trysteroTopic = "zensu-chat";

const TRYSTERO_STYLE = "color: teal;";

let trysteroRoom: Room | undefined;

export async function setupNostr(trysteroId: string) {
  console.log("%cCreating Nostr client...", TRYSTERO_STYLE);

  trysteroRoom = await joinRoom(
    {
      appId: trysteroAppId,
    },
    trysteroId
  );

  if (typeof window !== "undefined") {
    (window as any).trysteroRoom = trysteroRoom;
  }

  console.log(`%cNostr client created with id ${trysteroId}`, TRYSTERO_STYLE);

  trysteroRoom.onPeerJoin((peerId) => {
    console.log("%cNostr: Peer joined", TRYSTERO_STYLE, peerId);
  });

  trysteroRoom.onPeerLeave((peerId) => {
    console.log("%cNostr: Peer left", TRYSTERO_STYLE, peerId);
  });

  const [sendMessage, getMessages] = trysteroRoom.makeAction(trysteroTopic);

  getMessages((data, peerId) => {
    console.log(
      `%cNostr: Received message from ${peerId}: `,
      TRYSTERO_STYLE,
      data
    );
  });

  if (typeof window !== "undefined") {
    (window as any).sendTrysteroMessage = sendMessage;
  }
}
