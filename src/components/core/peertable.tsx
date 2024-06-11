import { Peer } from "../../rakis-core/synthient-chain/db/entities";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableFooter,
  Table,
} from "../ui/table";

function PeerTable({ peers, peerCount }: { peers: Peer[]; peerCount: number }) {
  return (
    <Card className="lg:h-[50vh] overflow-y-auto bg-green-50">
      <CardHeader>
        <CardTitle className="text-xl">
          Peers (last 24h) ({peerCount} total)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] text-sm">Id</TableHead>
              <TableHead className="text-sm">Seen</TableHead>
              <TableHead className="text-sm text-right">Last Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {peers
              .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
              .map((peer) => (
                <TableRow key={peer.synthientId}>
                  <TableCell className="text-xs font-medium">
                    {peer.synthientId.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {peer.seenOn
                      .map((network) =>
                        network === "gun" ? "pewpew" : network
                      )
                      .join(", ")}
                    <span className="ml-1 text-gray-400 text-[10px]">
                      ({peer.seenOn.length})
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {peer.lastSeen.toLocaleString([], {
                      year: "2-digit",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="text-sm" colSpan={2}>
                Total
              </TableCell>
              <TableCell className="text-sm text-right">
                {peers.length}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

export default PeerTable;
