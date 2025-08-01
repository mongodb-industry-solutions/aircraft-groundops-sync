"use client";

import React, { useState, useEffect } from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import PropTypes from "prop-types";
import styles from "./infoWizard.module.css";
import Button from "@leafygreen-ui/button";
import { Tabs, Tab } from "@leafygreen-ui/tabs";

// Custom Modal Component
const CustomModal = ({ open, setOpen, children, className }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onClick={() => setOpen(false)}>
      <div
        className={`${styles.modalContainer} ${className || ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={styles.modalCloseButton}
          onClick={() => setOpen(false)}
          aria-label="Close modal"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
};

const InfoWizard = ({
  open,
  setOpen,
  tooltipText = "Learn more",
  iconGlyph = "Wizard",
  sections = [],
}) => {
  const [selected, setSelected] = useState(0);

  return (
    <>
      <div className={styles.infoWizardButton}>
        <Button
          onClick={() => setOpen((prev) => !prev)}
          leftGlyph={<Icon glyph={iconGlyph} />}
        >
          Tell me more!
        </Button>
      </div>

      <CustomModal open={open} setOpen={setOpen} className={styles.modal}>
        <div className={styles.modalContent}>
          <Tabs
            aria-label="info wizard tabs"
            setSelected={setSelected}
            selected={selected}
          >
            {sections.map((tab, tabIndex) => (
              <Tab key={tabIndex} name={tab.heading}>
                {tab.content.map((section, sectionIndex) => (
                  <div key={sectionIndex} className={styles.section}>
                    {section.heading && (
                      <H3 className={styles.modalH3}>{section.heading}</H3>
                    )}
                    {section.body &&
                      (Array.isArray(section.body) ? (
                        <ul className={styles.list}>
                          {section.body.map((item, idx) =>
                            typeof item === "object" ? (
                              <li key={idx}>
                                {item.heading}
                                <ul className={styles.list}>
                                  {item.body.map((subItem, subIdx) => (
                                    <li key={subIdx}>
                                      <Body className={styles.body}>
                                        {subItem}
                                      </Body>
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ) : (
                              <li key={idx}>
                                <Body className={styles.body}>{item}</Body>
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <Body className={styles.body}>{section.body}</Body>
                      ))}

                    {section.image && (
                      <img
                        src={section.image.src}
                        alt={section.image.alt}
                        width={section.image.width || 550}
                        className={styles.modalImage}
                      />
                    )}
                  </div>
                ))}
              </Tab>
            ))}
          </Tabs>
        </div>
      </CustomModal>
    </>
  );
};

InfoWizard.propTypes = {
  open: PropTypes.bool.isRequired,
  setOpen: PropTypes.func.isRequired,
  tooltipText: PropTypes.string,
  iconGlyph: PropTypes.string,
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      heading: PropTypes.string.isRequired, // Tab title
      content: PropTypes.arrayOf(
        PropTypes.shape({
          heading: PropTypes.string,
          body: PropTypes.string,
          image: PropTypes.shape({
            src: PropTypes.string.isRequired,
            alt: PropTypes.string.isRequired,
            width: PropTypes.number,
          }),
        })
      ).isRequired,
    })
  ),
};

export default InfoWizard;
