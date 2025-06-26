"use client";

import React, { useState } from 'react';
import Icon from '@leafygreen-ui/icon';
import { H2, Subtitle, Description } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Banner from "@leafygreen-ui/banner";
import { MongoDBLogo } from "@leafygreen-ui/logo";
import styles from './OutboundOps.module.css';

const OutboundOps = ({ onOperationSelected }) => {
    const [selectedOperation, setSelectedOperation] = useState(null);

    const operations = [
        {
            id: 'pre_departure',
            title: 'Pre-Departure',
            description: 'Initial checks before aircraft departure',
            icon: 'Wrench',
            steps: 11
        },
        {
            id: 'pushback_prep',
            title: 'Pushback Preparation',
            description: 'Prepare aircraft for pushback operations',
            icon: 'Resource',
            steps: 6
        },
        {
            id: 'pushback_pull_forward',
            title: 'Pushback & Pull Forward',
            description: 'Execute P & PF maneuvers',
            icon: 'MultiDirectionArrow',
            steps: 5
        },
        {
            id: 'towing_completion',
            title: 'Towing Completion',
            description: 'Complete towing & secure aircraft',
            icon: 'CheckmarkWithCircle',
            steps: 7
        }
    ];

    const handleOperationSelect = (operation) => {
        setSelectedOperation(operation);
    };

    const handleProceed = () => {
        if (selectedOperation && onOperationSelected) {
            onOperationSelected(selectedOperation);
        }
    };

    return (
        <div className={styles.customModalOverlay}>
            <div className={styles.customModalBox}>
                <div className={styles.modalMainContent}>
                    <MongoDBLogo />
                    <H2 className={styles.centerText}>Outbound Operations</H2>
                    <br />
                    <Description className={styles.descriptionModal}>
                        Choose from the following ground operations:
                    </Description>
                    
                    <div className={styles.operationsContainer}>
                        {operations.map(operation => (
                            <Card
                                key={operation.id}
                                className={`${styles.operationCard} ${styles.cursorPointer} ${
                                    selectedOperation && selectedOperation.id === operation.id ? styles.operationSelected : ''
                                }`}
                                onClick={() => handleOperationSelect(operation)}
                                tabIndex={0}
                            >
                                <div className={styles.operationIcon}>
                                    <Icon glyph={operation.icon} size="x-large" />
                                </div>
                                <h3 className={styles.operationTitle}>{operation.title}</h3>
                                <p className={styles.operationDescription}>{operation.description}</p>
                                <div className={styles.operationSteps}>
                                    {operation.steps} steps
                                </div>
                            </Card>
                        ))}
                    </div>

                    <div className={styles.proceedContainer}>
                        <button
                            className={`${styles.proceedButton} ${!selectedOperation ? styles.disabledButton : ''}`}
                            onClick={handleProceed}
                            disabled={!selectedOperation}
                        >
                            Proceed with {selectedOperation ? selectedOperation.title : 'Operation'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OutboundOps;
