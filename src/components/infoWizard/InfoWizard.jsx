"use client";

import React, { useState } from "react";
import { H3, Subtitle, Body } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import PropTypes from "prop-types";
import styles from "./InfoWizard.module.css";
import Button from "@leafygreen-ui/button";
import { Tabs, Tab } from "@leafygreen-ui/tabs";

const InfoWizard = ({
  open,
  setOpen,
  tooltipText = "Learn more",
  iconGlyph = "Wizard",
  sections = [],
}) => {
  const [selected, setSelected] = useState(0);

  if (!open)
    return (
      <Button
        onClick={() => setOpen((prev) => !prev)}
        leftGlyph={<Icon glyph={iconGlyph} />}
        className={styles.infoWizardButton}
      >
        {tooltipText}
      </Button>
    );

  return (
    <>
      <Button
        onClick={() => setOpen((prev) => !prev)}
        leftGlyph={<Icon glyph={iconGlyph} />}
        className={styles.infoWizardButton}
      >
        {tooltipText}
      </Button>

      <div className={styles.modalOverlay} onClick={() => setOpen(false)}>
        <div
          className={styles.modalContainer}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={styles.modalCloseButton}
            onClick={() => setOpen(false)}
          >
            ×
          </button>
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
                                <li key={idx} className={styles.subtitleItem}>
                                  <Subtitle>{item.heading}</Subtitle>
                                  <ul className={styles.subtitleBodyList}>
                                    {item.body.map((subItem, subIdx) => (
                                      <li key={subIdx}>
                                        <Body>{subItem}</Body>
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              ) : (
                                <li key={idx}>
                                  <Body>{item}</Body>
                                </li>
                              )
                            )}
                          </ul>
                        ) : (
                          <Body>{section.body}</Body>
                        ))}

                      {section.image && (
                        <img
                          src="/demoOverview.png"
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
        </div>
      </div>
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
      heading: PropTypes.string.isRequired,
      content: PropTypes.arrayOf(
        PropTypes.shape({
          heading: PropTypes.string,
          body: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
          ]),
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