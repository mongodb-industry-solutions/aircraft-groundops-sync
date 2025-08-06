"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "./NavigationBar.module.css";
import InfoWizard from "../InfoWizard/InfoWizard";
import { useState } from "react";
import { usePathname } from "next/navigation";


const NavigationBar = () => {
  const [openHelpModal, setOpenHelpModal] = useState(false);
  const pathname = usePathname();

  return (
    <nav className={styles.navbar}>
      <div className={styles.logoContainer}>
        <Link href="/">
          <Image
            src="/logo/gops_logo.png"
            width={140}
            height={32}
            priority
            alt="GroundOps Logo"
          />
        </Link>
      </div>
      <div className={styles.linkContainer}></div>

      <InfoWizard
        open={openHelpModal}
        setOpen={setOpenHelpModal}
        tooltipText="Tell me more!"
        iconGlyph="Wizard"
        sections={[
          {
            heading: "Instructions and Talk Track",
            content: [
              {
                heading: "Demo Purpose",
                body: "The demo simulates a simplified checklist outbound operation for an aircraft ground operations scenario. The goal is to demonstrate how the system can assist in retrieving information relevant for tasks, tracking progress, and ensuring compliance with operational standards.",
              },
              {
                heading: "How to Demo",
                body: [
                  {
                    heading: "Login",
                    body: [
                      "Click on one of the login user buttons",
                    ],
                  },
                  {
                    heading: "Outbound Operations",
                    body: [
                      "This will allow you to select an outbound operation to work on",
                    ],
                  },
                  {
                    heading: "Assistant",
                    body: [
                      "Once selected an Outbound Operation, you can ask by voice the assistant aviation related questions, such as: 'Where can I find the APU?'",
                      "Wait a few seconds for the assistant to respond with the manual information, which will be read out loud by the text to speech.",
                    ],
                  },
                  {
                    heading: "Checklist",
                    body: [
                      "With a selected Outbound Operation, you'll be able to begin the assistant guided checklist by saying 'Begin checklist'.",
                      "Wait a few seconds for the checklist retrieval which will prompt step by step instructions, waiting for your voice confirmation to proceed to the next step by saying 'Done', 'Check' or 'Completed'. ",
                      "If prefered, you can select the manual mode by clicking above the desired number step.",
                    ],
                  },
                  {
                    heading: "Checklist Completion",
                    body: [
                      "Once all steps are completed, the assistant will confirm checklist completion and notify the session is closed.",
                    ],
                  },
                ],
              },
            ],
          },
          {
            heading: "Behind the Scenes",
            content: [
              {
                heading: "Data Flow",
                body: "",
              },
              {
                image: {
                  src: "/demoOverview.png",
                  alt: "Architecture",
                },
              },
            ],
          },
          {
            heading: "Why MongoDB?",
            content: [
              {
                heading: "Flexible Schema Design",
                body: "Aircraft ground operations require flexible data structures for handling diverse operational data—from flight schedules to maintenance records. MongoDB's document-oriented design allows data to be stored in JSON-like structures, making it easy to adapt to changing operational requirements without rigid schema constraints.",
              },
              {
                heading: "Real-Time Data Processing",
                body: "MongoDB supports real-time data ingestion and synchronization, making it ideal for capturing live aircraft status updates and ground operation events. This ensures the system provides up-to-date information for timely decision-making in aircraft operations.",
              },
              {
                heading: "Rich Querying and Analytics",
                body: "MongoDB's aggregation framework and powerful querying capabilities enable in-depth analysis of aircraft operations data. Teams can cross-reference flight schedules with maintenance records and operational metrics to optimize ground operations efficiency.",
              },
              {
                heading: "Scalability for Growing Operations",
                body: "MongoDB's distributed architecture allows it to scale horizontally, which is valuable in large airport environments where data volumes can grow rapidly. MongoDB clusters can be easily expanded to handle increased aircraft traffic and operational complexity.",
              },
              {
                heading: "Vector Search for RAG",
                body: "MongoDB Atlas Vector Search enables the RAG application to perform semantic similarity searches on aircraft manuals and operational documents, providing contextually relevant information to ground crew and operators.",
              },
              {
                heading: "High Availability",
                body: "MongoDB's replica sets ensure ultra-high availability for critical aircraft operations data, with automatic failover and updates without downtime—essential for 24/7 airport operations.",
              },
            ],
          },
        ]}
      />

    </nav>
  );
};
export default NavigationBar;