"use client";

import React, { useState, useEffect } from 'react';
import { H1, H2, H3, Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Button from '@leafygreen-ui/button';
import Icon from '@leafygreen-ui/icon';
import ChatView from '@/components/chatView/ChatView';
import styles from './checklist.module.css';

const Checklist = ({ selectedOperation, onBack }) => {
  const [checklistData, setChecklistData] = useState(null);
  const [completedItems, setCompletedItems] = useState({});
  const [priorOpen, setPriorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChecklistData = async () => {
      if (!selectedOperation) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Fetching checklist for operation:', selectedOperation.id);
        const response = await fetch('/api/checklist/get', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operationId: selectedOperation.id }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error:', response.status, errorText);
          throw new Error(`API endpoint returned ${response.status}: ${errorText}`);
        } else {
          const data = await response.json();
          console.log('Fetched checklist data:', data);
          setChecklistData(data);
        }
      } catch (err) {
        setError('Failed to fetch checklist data');
        console.error('Error fetching checklist:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChecklistData();
  }, [selectedOperation]);

  const handleItemComplete = (itemId) => {
    setCompletedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const getCompletionStats = () => {
    if (!checklistData) return { completed: 0, total: 0, percentage: 0 };
    
    const totalMainItems = checklistData.checklist?.length || 0;
    const completedMainItems = Object.entries(completedItems)
      .filter(([itemId, isCompleted]) => isCompleted && itemId.startsWith('main_'))
      .length;
    const percentage = totalMainItems > 0 ? Math.round((completedMainItems / totalMainItems) * 100) : 0;
    
    return { completed: completedMainItems, total: totalMainItems, percentage };
  };

  const renderChecklistTable = (items, title, tableId) => {
    if (!items || items.length === 0) return null;

    const sortedItems = [...items].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999999;
      const orderB = b.order !== undefined ? b.order : 999999;
      return orderA - orderB;
    });
    const isPriorChecklist = tableId === 'prior';

    return (
      <div className={styles.tableSection}>
        <H3 className={styles.sectionTitle}>{title}</H3>
        <div className={styles.tableContainer}>
          <table className={styles.checklistTable}>
            <thead>
              <tr>
                <th className={styles.orderHeader}>Step</th>
                <th className={styles.stepHeader}>Procedure</th>
                <th className={styles.statusHeader}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, index) => {
                // Ensure unique key by using index as fallback if order is undefined
                const orderKey = item.order !== undefined ? item.order : index;
                const itemId = `${tableId}_${orderKey}`;
                const isCompleted = completedItems[itemId];
                    let isInProgress = false;
                    let isClickable = false;
                if (isPriorChecklist) {
                  isClickable = true;
                } else {
                  const prevOrderKey = sortedItems[index - 1]?.order !== undefined ? sortedItems[index - 1]?.order : index - 1;
                  const isPrevCompleted = index === 0 || completedItems[`${tableId}_${prevOrderKey}`];
                  isInProgress = !isCompleted && isPrevCompleted;
                  isClickable = isCompleted || isInProgress;
                }
                
                return (
                  <tr 
                    key={itemId} 
                    className={`${styles.tableRow} ${
                      isCompleted ? styles.completedRow : 
                      isInProgress ? styles.inProgressRow : 
                      styles.pendingRow
                    }`}
                    onClick={() => isClickable && handleItemComplete(itemId)}
                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                  >
                    <td className={styles.orderCell}>
                      <div className={`${styles.orderBadge} ${
                        isCompleted ? styles.completedBadge : 
                        isInProgress ? styles.inProgressBadge : 
                        styles.pendingBadge
                      }`}>
                        {item.order !== undefined ? item.order : index + 1}
                      </div>
                    </td>
                    <td className={styles.stepCell}>
                      <Body className={styles.stepText}>{item.step}</Body>
                    </td>
                    <td className={styles.statusCell}>
                      <div className={styles.statusIndicator}>
                        {isCompleted ? (
                          <span className={styles.statusText}>Done</span>
                        ) : isInProgress ? (
                          <span className={styles.statusText}>In Progress</span>
                        ) : (
                          <span className={styles.statusText}>Pending</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Icon glyph="Refresh" size="large" />
        <H2>Loading checklist...</H2>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Icon glyph="Warning" size="large" />
        <H2>Error loading checklist</H2>
        <Body>{error}</Body>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!checklistData) {
    return (
      <div className={styles.noDataContainer}>
        <Icon glyph="InfoWithCircle" size="large" />
        <H2>No checklist available</H2>
        <Body>No checklist data found</Body>
      </div>
    );
  }

  const stats = getCompletionStats();

  return (
    <div className={styles.checklistPage}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Button
            onClick={onBack}
            variant="default"
            leftGlyph={<Icon glyph="ArrowLeft" />}
            size="small"
          >
            Back to Operations
          </Button>
        </div>
        <div className={styles.headerCenter}>
          <H1 className={styles.pageTitle}>
            {checklistData.operationTitle} Checklist
          </H1>
          <div className={styles.progressInfo}>
            <Body>
              Progress: {stats.completed} of {stats.total} completed ({stats.percentage}%)
            </Body>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          {stats.percentage === 100 && (
            <div className={styles.completionBadge}>
              <Icon glyph="CheckmarkWithCircle" fill="#00ED64" />
              <Body weight="medium">Complete!</Body>
            </div>
          )}
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.checklistSection}>
          {checklistData.prior && checklistData.prior.length > 0 && (
            <Card className={styles.priorCard}>
              <div 
                className={styles.priorHeader}
                onClick={() => setPriorOpen(!priorOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.priorHeaderContent}>
                  <Icon glyph="Warning" fill="#FFB000" />
                  <H3>Prior Checks ({checklistData.prior.length} items)</H3>
                  <Body className={styles.priorDescription}>
                    Confirm these checks were performed before proceeding with main checklist
                  </Body>
                  <Icon 
                    glyph={priorOpen ? "ChevronUp" : "ChevronDown"} 
                    className={styles.dropdownIcon}
                  />
                </div>
              </div>
              {priorOpen && (
                <div className={styles.priorContent}>
                  {renderChecklistTable(checklistData.prior, "Prior Checks", "prior")}
                </div>
              )}
            </Card>
          )}

          {checklistData.checklist && checklistData.checklist.length > 0 && (
            <Card className={styles.mainChecklistCard}>
              {renderChecklistTable(checklistData.checklist, "Main Checklist", "main")}
            </Card>
          )}

          {stats.percentage === 100 && (
            <Card className={styles.completionCard}>
              <div className={styles.completionContent}>
                <Icon glyph="CheckmarkWithCircle" size="large" fill="#00ED64" />
                <H2>Checklist Complete!</H2>
                <Body>
                  All main steps for {checklistData.operationTitle} have been completed successfully.
                </Body>
              </div>
            </Card>
          )}
        </div>

        <div className={styles.assistantSection}>
          <Card className={styles.assistantCard}>
            <div className={styles.assistantHeader}>
              <Icon glyph="PersonWithLock" size="large" />
              <H3>Ground Operations Assistant</H3>
              <Body>Ask questions about any checklist item or procedure</Body>
            </div>
            <div className={styles.assistantContent}>
              <ChatView
                setCurrentView={() => {}}
                simulationMode={false}
                selectedDevice={null}
                selectedOperation={selectedOperation}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Checklist;
