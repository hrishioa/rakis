import { ReceivedPeerPacket, TransmittedPeerPacket } from "../db/packet-types";

export type BroadcastPacketFunc = (
  packet: TransmittedPeerPacket
) => Promise<boolean>;

export type PacketReceivedCallback<AvailablePeerInfo> = (
  packet: ReceivedPeerPacket,
  peerInfo: AvailablePeerInfo
) => void;

export type UnregisterCallback = () => void;

export type ListenForPacketFunc<AvailablePeerInfo> = (
  callback: PacketReceivedCallback<AvailablePeerInfo>
) => UnregisterCallback;

export type RegisterErrorHandler = (
  errorHandler: (error: Error) => void
) => void;

export abstract class P2PNetworkInstance<BootstrapOptions, AvailablePeerInfo> {
  protected constructor(
    private synthientId: string,
    private options: BootstrapOptions
  ) {}

  abstract waitForReady(): Promise<boolean>;
  abstract broadcastPacket(packet: TransmittedPeerPacket): Promise<boolean>;
  abstract listenForPacket(
    callback: PacketReceivedCallback<AvailablePeerInfo>
  ): UnregisterCallback;
  abstract registerErrorHandler(errorHandler: (error: Error) => void): void;
  abstract gracefulShutdown(): void;
}
