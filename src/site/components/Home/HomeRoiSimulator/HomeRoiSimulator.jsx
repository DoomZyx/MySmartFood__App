import React from "react";
import { motion } from "framer-motion";
import { useDemoModal } from "../../../contexts/DemoModalContext";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import { useRoiSimulator } from "../../../hooks/useRoiSimulator";
import { formatEuros, STARTER_PLAN_EUROS } from "../../../utils/roiCalculator";
import "./HomeRoiSimulator.scss";

const HomeRoiSimulator = () => {
  const { openDemoModal } = useDemoModal();
  const headerAnimation = useOptimizedAnimation(0);
  const { averageBasket, missedCallsPerWeek, setAverageBasket, setMissedCallsPerWeek, result } =
    useRoiSimulator();

  return (
    <section className="roi-section" id="simulateur-roi">
      <div className="roi-content">
        <motion.div {...headerAnimation} className="roi-header">
          <h2 className="roi-title">
            Combien vous coûtent{" "}
            <span className="text-gradient">les appels manqués</span> ?
          </h2>
          <p className="roi-intro">
            Indiquez votre panier moyen et le nombre d&apos;appels non décrochés
            sur une semaine. Le calcul suppose qu&apos;un appel manqué = une
            commande au panier moyen.
          </p>
        </motion.div>

        <div className="roi-card">
          <div className="roi-fields">
            <label htmlFor="roi-basket">
              Panier moyen
              <input
                id="roi-basket"
                type="number"
                min="1"
                max="500"
                step="1"
                value={averageBasket}
                onChange={(event) => setAverageBasket(event.target.value)}
              />
            </label>
            <label htmlFor="roi-missed">
              Appels manqués / semaine
              <input
                id="roi-missed"
                type="number"
                min="0"
                max="400"
                step="1"
                value={missedCallsPerWeek}
                onChange={(event) => setMissedCallsPerWeek(event.target.value)}
              />
            </label>
          </div>

          <dl className="roi-results">
            <div>
              <dt>CA potentiel / semaine</dt>
              <dd>{formatEuros(result.weekly)}</dd>
            </div>
            <div>
              <dt>CA potentiel / mois</dt>
              <dd>{formatEuros(result.monthly)}</dd>
            </div>
            <div>
              <dt>CA potentiel / an</dt>
              <dd>{formatEuros(result.yearly)}</dd>
            </div>
          </dl>

          <p className="roi-compare">
            {result.planCovered
              ? `Ce volume dépasse déjà l'abonnement de départ (${STARTER_PLAN_EUROS} €/mois). L'assistant décroche pendant que la salle reste concentrée sur les clients présents.`
              : `L'abonnement de départ est à ${STARTER_PLAN_EUROS} €/mois. Même quelques appels rattrapés financent l'outil et rendent la salle au service.`}
          </p>

          <button type="button" className="btn btn-primary" onClick={openDemoModal}>
            Voir comment ça se passe en service
          </button>
        </div>
      </div>
    </section>
  );
};

export default HomeRoiSimulator;
