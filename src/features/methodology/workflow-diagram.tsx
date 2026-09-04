import { ArrowDown, ArrowRight, Check, ClipboardCheck, Database, Download, HardDrive, Landmark, Files, Building2 } from "lucide-react";
import Image from "next/image";
import styles from "./workflow-diagram.module.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const sources = [
  { title: "Regulators", detail: "Licenses, inspections, public notices", icon: Landmark },
  { title: "Government datasets", detail: "Reactors, fuel, waste, and operations", icon: Files },
  { title: "Company filings", detail: "Project announcements and disclosures", icon: Building2 },
];

export function WorkflowDiagram() {
  return <figure data-workflow-diagram aria-labelledby="data-journey-title" className={styles.diagram}>
    <figcaption id="data-journey-title" className="sr-only">From public sources through review to Nuclear Atlas, with a separate local archive</figcaption>
    <div className={styles.journey}>
      <div className={styles.sources} data-workflow-step>
        {sources.map(({title, detail, icon: Icon}) => <div key={title} className={styles.source}>
          <div className={styles.document} aria-hidden="true"><Icon size={22}/><span/><span/><span/></div>
          <div><h3>{title}</h3><p>{detail}</p></div>
        </div>)}
      </div>
      <svg className={styles.convergence} viewBox="0 0 80 300" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50 H15 Q40 50 40 100 V125 Q40 150 70 150 M0 150 H70 M0 250 H15 Q40 250 40 200 V175 Q40 150 70 150"/><path d="M63 144 L71 150 L63 156"/></svg>
      <div className={styles.checkpoint} data-workflow-step>
        <div className={styles.reviewIcon}><ClipboardCheck size={48} strokeWidth={1.4} aria-hidden="true"/></div>
        <h3>Review evidence</h3><p>Sources, dates,<br/>and facility match</p>
        <span className={styles.caption}>Reviewed workbook</span>
      </div>
      <ArrowRight className={styles.forward} aria-hidden="true"/>
      <div className={styles.checkpoint} data-workflow-step>
        <div className={styles.approvalIcon}><Check size={44} strokeWidth={2} aria-hidden="true"/></div>
        <h3>Approve a snapshot</h3><p>Validated release<br/>and public downloads</p>
      </div>
      <ArrowRight className={styles.forward} aria-hidden="true"/>
      <div className={styles.preview} data-workflow-step>
        <h3>Explore Nuclear Atlas</h3>
        <a href={`${basePath}/`} aria-label="Explore Nuclear Atlas"><Image src={`${basePath}/methodology/atlas-preview.png`} width={1440} height={1000} alt="Nuclear Atlas showing its lifecycle navigation, map, and evidence workspace" className={styles.previewImage}/></a>
        <p>The published map, table, and evidence</p>
      </div>
    </div>
    <div className={styles.archiveBranch}>
      <div className={styles.import}><span className={styles.dashed}/><ArrowDown size={16} aria-hidden="true"/><span>Manual import</span></div>
      <div className={styles.archiveRow}>
        <p className={styles.archiveInput}>Also accepts<br/>prepared source JSON <ArrowRight size={18} aria-hidden="true"/></p>
        <div className={styles.archive}><Database size={36} strokeWidth={1.4} aria-hidden="true"/><div><h3>Local archive</h3><p>SQLite + original JSON files</p></div></div>
        <div className={styles.outputs}>
          <div><Download size={22} aria-hidden="true"/><span>Reproduce original files</span></div>
          <div><HardDrive size={22} aria-hidden="true"/><span>Back up the database</span></div>
        </div>
      </div>
      <p className={styles.archiveNote}>Stored on this computer. Imports preserve evidence; they do not publish to the website.</p>
    </div>
    <ol aria-label="Publishing process" className="sr-only">{["Public sources", "Reviewed workbook", "Approved release", "Nuclear Atlas"].map(title => <li key={title}>{title}</li>)}</ol>
  </figure>;
}
