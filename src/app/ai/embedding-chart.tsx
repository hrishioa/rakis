import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { UMAP } from "umap-js";
import { EmbeddingResult } from "../../core/synthient-chain/embeddings/types";
import { LLMModelName } from "../../core/synthient-chain/llm/types";
import { borderColorToHex, modelColors } from "./colors";

type EmbeddingChartProps = {
  embeddings: (EmbeddingResult & { modelName: LLMModelName })[];
};

const EmbeddingChart: React.FC<EmbeddingChartProps> = ({ embeddings }) => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    const texts: string[] = [];
    const colors: string[] = [];

    if (embeddings.length >= 6) {
      const umap = new UMAP({
        nComponents: 3,
        nNeighbors: 3,
        minDist: 0.1,
        spread: 1,
      });

      umap.fit(embeddings.map((embedding) => embedding.embedding));
      const embeddings3D = umap.getEmbedding();

      console.log("Computed Points", embeddings3D);

      embeddings3D.forEach((point, index) => {
        x.push(point[0]);
        y.push(point[1]);
        z.push(point[2]);
        texts.push(embeddings[index].text);
        const modelColorClass = modelColors[embeddings[index].modelName];
        const colorHex = borderColorToHex[modelColorClass];
        colors.push(colorHex);
      });
    }

    setData([
      {
        x,
        y,
        z,
        text: texts.map(
          (text, index) =>
            `${embeddings[index].modelName.slice(0, 100)}: ${text.slice(
              0,
              100
            )}`
        ),
        mode: "markers",
        marker: {
          size: 5,
          color: colors,
        },
        type: "scatter3d",
      },
    ]);
  }, [embeddings]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Plot
        data={data}
        layout={{
          autosize: true,
          title: "Clusters",
          scene: {
            xaxis: { title: "X Axis" },
            yaxis: { title: "Y Axis" },
            zaxis: { title: "Z Axis" },
          },
        }}
        useResizeHandler={true}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};

export default EmbeddingChart;
