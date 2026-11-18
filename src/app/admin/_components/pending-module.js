import { CheckCircleIcon } from "@phosphor-icons/react";
import { PageHeading } from "./admin-ui";
import styles from "../admin.module.css";

export default function PendingModule({
  title,
  description,
  Icon,
  message,
  capabilities,
}) {
  return (
    <div className={styles.page}>
      <PageHeading description={description} title={title} />
      <div className={styles.pendingLayout}>
        <section className={`${styles.panel} ${styles.empty}`}>
          <Icon aria-hidden size={42} weight="duotone" />
          <h2>Consulta administrativa indisponível</h2>
          <p>{message}</p>
        </section>
        <aside className={`${styles.panel} ${styles.card}`}>
          <h2>Operações previstas</h2>
          <ul className={styles.checkList}>
            {capabilities.map((capability) => (
              <li key={capability}>
                <CheckCircleIcon aria-hidden size={18} />
                {capability}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
