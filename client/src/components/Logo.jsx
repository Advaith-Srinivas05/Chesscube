import styles from './Logo.module.css';

// Drawn as a mask over public/logo.svg so the mark takes the theme's logo colour.
export default function Logo() {
  return <span className={styles.logo} role="img" aria-label="Chesscube" />;
}
