import { useTranslation } from "react-i18next";
import CallsPerDay from "../callsPerDay";
import "./layoutGraph.scss";

function Graphs() {
  const { t } = useTranslation();
  
  return (
    <>
      <div className="layout-callsgraph">
        <div className="callsgraph-container">
          <div className="graph-title">
            <h3>
              <i className="bi bi-graph-up-arrow"></i> {t('graphs.dailyEvolution')}
            </h3>
          </div>
          <CallsPerDay />
        </div>
      </div>
    </>
  );
}

export default Graphs;
