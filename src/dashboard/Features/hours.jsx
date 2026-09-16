import { useEffect, useState } from "react";

export default function Clock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setTime(`${hours}:${minutes}`);
    };

    updateClock(); // Première exécution immédiate
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval); // Nettoyage à la destruction
  }, []);

  return (
    <div id="clock" style={{ fontSize: "96px", fontWeight: "semi-bold", textAlign: "center", color: "white" }}>
      {time}
    </div>
  );
}
