import Twemoji from 'react-twemoji';
import './EmojiText.scss';

/**
 * Composant wrapper pour afficher les emojis avec Twemoji
 * @param {Object} props - Les propriétés du composant
 * @param {React.ReactNode} props.children - Le contenu avec des emojis
 * @param {string} props.className - Classe CSS optionnelle
 */
function EmojiText({ children, className = '', ...props }) {
  return (
    <Twemoji 
      options={{ 
        className: 'emoji-icon',
        folder: 'svg',
        ext: '.svg'
      }}
    >
      <span className={className} {...props}>
        {children}
      </span>
    </Twemoji>
  );
}

export default EmojiText;

