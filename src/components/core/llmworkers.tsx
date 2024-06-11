import {
  LLMModelName,
  LLMEngineLogEntry,
} from "../../rakis-core/synthient-chain/llm/types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "../ui/table";

function LLMWorkers({
  llmWorkerStates,
  llmEngineLog,
}: {
  llmWorkerStates: {
    [workerId: string]: { modelName: LLMModelName; state: string };
  };
  llmEngineLog: LLMEngineLogEntry[];
}) {
  function getLogRef(entry: LLMEngineLogEntry) {
    if (entry.type === "engine_loading" || entry.type === "engine_loaded")
      return entry.modelName;

    if (entry.type === "engine_loading_error") return entry.modelName;

    if (
      entry.type === "engine_inference_start" ||
      entry.type === "engine_inference_error" ||
      entry.type === "engine_inference_streaming_result"
    )
      return entry.inferenceId;

    return "-";
  }

  function getLogData(entry: LLMEngineLogEntry) {
    if (entry.type === "engine_loading" || entry.type === "engine_loaded")
      return "-";

    if (entry.type === "engine_loading_error") return entry.error;

    if (entry.type === "engine_inference_start")
      return JSON.stringify(entry.params);

    if (entry.type === "engine_inference_error") return entry.error;

    if (entry.type === "engine_inference_streaming_result")
      return `Tokens: ${entry.tokenCount} - ${entry.result}`;

    return "-";
  }

  return (
    <Card className="lg:h-[50vh] overflow-y-auto bg-blue-50">
      <CardHeader>
        <CardTitle className="text-xl">Inference Engine</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-full">
        <div className="mb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm">Worker Id</TableHead>
                <TableHead className="text-sm">Model</TableHead>
                <TableHead className="text-sm text-right">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(llmWorkerStates).map(
                ([workerId, { modelName, state }]) => (
                  <TableRow key={workerId}>
                    <TableCell className="text-xs">{workerId}</TableCell>
                    <TableCell className="text-sm">{modelName}</TableCell>
                    <TableCell className="text-sm text-right">
                      {state}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm">Worker</TableHead>
                <TableHead className="text-sm">Type</TableHead>
                <TableHead className="text-sm">Ref</TableHead>
                <TableHead className="text-sm">Data</TableHead>
                <TableHead className="text-sm text-right">At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {llmEngineLog
                .sort((a, b) => b.at!.getTime() - a.at!.getTime())
                .map((entry, index) => (
                  <TableRow key={entry.workerId + entry.at!.toISOString()}>
                    <TableCell className="text-xs">{entry.workerId}</TableCell>
                    <TableCell className="text-xs">
                      {entry.type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {getLogRef(entry)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {getLogData(entry)}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {entry.at!.toLocaleString([], {
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
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default LLMWorkers;
