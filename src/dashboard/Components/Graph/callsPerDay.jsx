import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { fetchCallsByDate } from "../../API/Calls/api";
import "./callsPerDay.scss";

export default function CallsPerDay() {
  const [callsData, setCallsData] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    async function loadCalls() {
      try {
        const json = await fetchCallsByDate();

        if (!json.data || !Array.isArray(json.data)) {
          throw new Error("Format API invalide");
        }

        // Regroupement des counts par date
        const groupedMap = {};

        json.data.forEach(({ date, count }) => {
          if (!groupedMap[date]) groupedMap[date] = 0;
          groupedMap[date] += count;
        });

        const grouped = Object.entries(groupedMap).map(([date, appels]) => ({
          date,
          appels,
        }));

        const todayStr = new Date().toISOString().slice(0, 10);

        const filteredToday = grouped.filter((item) => item.date === todayStr);

        setCallsData(filteredToday);
      } catch (error) {
      }
    }

    loadCalls();
  }, []);

  const CustomActiveShape = (props) => {
    const { x, y, width, height, fill } = props;
    // Retourne juste la même barre sans changer le fill ou ajouter un fond
    return <rect x={x} y={y} width={width} height={height} fill={fill} />;
  };

  return (
    <div className="chart-container"
    > 
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={callsData}
          margin={{ top: 20, right: 30, bottom: 20, left: -20 }}
          onMouseLeave={() => setActiveIndex(null)} //Désactive le fond transparent au hover
        >
          <CartesianGrid stroke="rgba(0, 0, 0, 0.08)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickCount={40}
          />
          <Tooltip
            labelStyle={{
              color: "#1f2937",
              fontWeight: "600",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              borderRadius: "12px",
            }}
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              borderRadius: "12px",
              color: "#1f2937",
            }}
            cursor={{ fill: "transparent" }} // empeche le fond du hover
          />
          <Bar
            dataKey="appels"
            fill="#6366f1"
            radius={[8, 8, 0, 0]}
            barSize={30}
            animationDuration={500}
          >
            <LabelList
              dataKey="appels"
              position="top"
              style={{ fill: "#6366f1", fontSize: 14, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
