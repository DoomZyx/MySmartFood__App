import React from "react";
import { useTranslation } from "react-i18next";
import { choiceName, choicePrice } from "../../utils/menuOptions";
import "./CustomOptionsSection.scss";

export function CustomOptionsSection({ categorie, options, onUpdateOptions }) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = React.useState({});

  const categorieLower = categorie.toLowerCase();
  const isCustomizable = categorieLower.includes('tacos') || 
                         categorieLower.includes('burger') || 
                         categorieLower.includes('sandwich');
  
  const isExcluded = ['menus', 'menu', 'boissons', 'boisson', 'desserts', 'dessert', 'accompagnements', 'accompagnement']
    .some(cat => categorieLower.includes(cat));
  
  if (isExcluded || !isCustomizable) {
    return null;
  }

  React.useEffect(() => {
    if (!options || Object.keys(options).length === 0) {
      const defaultOptions = categorieLower.includes('tacos') ? {
        viandes: {
          nom: "Viandes",
          choix: [
            { nom: "Poulet", prix: 0 },
            { nom: "Bœuf", prix: 0 },
            { nom: "Agneau", prix: 0 },
            { nom: "Mixte", prix: 0 }
          ],
          multiple: false,
          obligatoire: true
        },
        sauces: {
          nom: "Sauces",
          choix: [
            { nom: "Algérienne", prix: 0 },
            { nom: "Blanche", prix: 0 },
            { nom: "Samourai", prix: 0 },
            { nom: "Harissa", prix: 0 },
            { nom: "Ketchup", prix: 0 },
            { nom: "Mayonnaise", prix: 0 }
          ],
          multiple: true,
          obligatoire: true
        },
        crudites: {
          nom: "Crudités",
          choix: [
            { nom: "Salade", prix: 0 },
            { nom: "Tomates", prix: 0 },
            { nom: "Oignons", prix: 0 },
            { nom: "Cornichons", prix: 0 }
          ],
          multiple: true,
          obligatoire: false
        }
      } : {};
      
      if (Object.keys(defaultOptions).length > 0) {
        onUpdateOptions(defaultOptions);
      }
    }
  }, []);
  
  if (!options || Object.keys(options).length === 0) {
    return null;
  }

  const handleRemoveChoice = (optionKey, choixIndex) => {
    const newOptions = { ...options };
    newOptions[optionKey] = {
      ...newOptions[optionKey],
      choix: newOptions[optionKey].choix.filter((_, i) => i !== choixIndex)
    };
    onUpdateOptions(newOptions);
  };

  const handleAddChoice = (optionKey, value) => {
    const newOptions = { ...options };
    const current = newOptions[optionKey].choix || [];
    newOptions[optionKey] = {
      ...newOptions[optionKey],
      choix: [...current, value]
    };
    onUpdateOptions(newOptions);
  };

  const handleUpdateChoicePrice = (optionKey, choixIndex, prix) => {
    const newOptions = { ...options };
    const current = newOptions[optionKey].choix[choixIndex];
    const nom = choiceName(current);
    newOptions[optionKey] = {
      ...newOptions[optionKey],
      choix: newOptions[optionKey].choix.map((entry, index) =>
        index === choixIndex ? { nom, prix } : entry
      )
    };
    onUpdateOptions(newOptions);
  };

  const commitDraft = (optionKey) => {
    const draft = drafts[optionKey] || {};
    const nom = String(draft.nom || "").trim();
    if (!nom) return;
    const rawPrix = Number(draft.prix);
    const prix = Number.isFinite(rawPrix) && rawPrix > 0 ? rawPrix : 0;
    handleAddChoice(optionKey, { nom, prix });
    setDrafts((prev) => ({ ...prev, [optionKey]: { nom: "", prix: "" } }));
  };

  return (
    <div className="custom-options-wrapper">
      <div className="options-header">
        <h6>{t('configuration.menu.customOptions')}</h6>
        <p>{t('configuration.menu.customOptionsHelp')}</p>
      </div>
      
      {Object.entries(options || {}).map(([optionKey, optionData]) => (
        <div key={optionKey} className="option-box">
          <div className="option-top">
            <div className="option-name">
              <strong>{optionData.nom}</strong>
            </div>
          </div>
          
          <div className="option-choices">
            <label className="choices-label">{t('configuration.menu.choices')} :</label>
            <div className="tags-list">
              {(optionData.choix || []).map((choix, idx) => (
                <span key={`${choiceName(choix)}-${idx}`} className="choice-badge">
                  {choiceName(choix)}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="choice-price-input"
                    value={choicePrice(choix)}
                    onChange={(e) =>
                      handleUpdateChoicePrice(
                        optionKey,
                        idx,
                        parseFloat(e.target.value) || 0
                      )
                    }
                    onFocus={(e) => e.target.select()}
                    title={t('configuration.menu.optionSurcharge')}
                    aria-label={t('configuration.menu.optionSurcharge')}
                  />
                  <span className="choice-price-suffix">€</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChoice(optionKey, idx)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="choice-add-row">
              <input
                type="text"
                className="choice-input"
                placeholder={t('configuration.menu.addChoice')}
                value={drafts[optionKey]?.nom || ""}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [optionKey]: { ...(prev[optionKey] || {}), nom: e.target.value }
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitDraft(optionKey);
                  }
                }}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="choice-input choice-draft-price"
                placeholder={t('configuration.menu.optionSurchargePlaceholder')}
                value={drafts[optionKey]?.prix ?? ""}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [optionKey]: { ...(prev[optionKey] || {}), prix: e.target.value }
                  }))
                }
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitDraft(optionKey);
                  }
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
