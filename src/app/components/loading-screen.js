import styles from "./loading-screen.module.css";

export default function LoadingScreen() {
  return (
    <div aria-live="polite" className={styles.screen} role="status">
      <span aria-hidden="true" className={styles.spinner} />
      <span>Carregando</span>
    </div>
  );
}
