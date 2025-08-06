"use client";

import React, { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import { Modal, Container } from 'react-bootstrap';
import { H2, Subtitle, Description } from '@leafygreen-ui/typography';
import styles from './Login.module.css';
import User from '@/components/User/User';
import { USER_MAP } from "@/lib/constants";
import Banner from "@leafygreen-ui/banner";
import { MongoDBLogo } from "@leafygreen-ui/logo";


const Login = ({ onUserSelected }) => {
    const [open, setOpen] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);

    const users = Object.entries(USER_MAP).map(([id, details]) => ({
        id,
        name: details.UserName,
        role: details.Role,
        employee: details.EmployeeNumber,
    }));

    const handleUserSelect = (user) => {
        setSelectedUser(user);
        setOpen(false);
        if (onUserSelected) onUserSelected(user);
    };

    if (!open) return null;

    return (
        <div className={styles.customModalOverlay}>
            <div className={styles.customModalBox}>
                <div
                    className={`d-flex flex-row-reverse p-1 cursorPointer ${!selectedUser ? styles.disabledCloseButton : ''}`}
                    style={{ position: 'absolute', top: 8, right: 12, zIndex: 2 }}
                    onClick={() => {
                        if (!selectedUser) {
                            alert("You must select a user before proceeding!");
                        } else {
                            setOpen(false);
                        }
                    }}
                >
                    <Icon glyph="X" />
                </div>
                <div className={styles.modalMainContent} style={{ padding: '32px 24px', height: '100%', justifyContent: 'center' }}>
                    <MongoDBLogo />
                    <H2 className={styles.centerText}>Welcome to Ground Ops Sync</H2>
                    <Subtitle className={`${styles.weightNormal} ${styles.centerText} mt-2`}>Airdome assistant for Towing Operations</Subtitle>
                    <br />
                    <Description className={styles.descriptionModal}>
                        Please select the user you would like to login as:
                    </Description>
                    <div className={styles.usersContainer}>
                        {users.map(user => (
                            <User
                                user={user}
                                isSelectedUser={selectedUser && selectedUser.id === user.id}
                                key={user.id}
                                setLocalSelectedUser={handleUserSelect}
                            />
                        ))}
                    </div>
                    <div className={styles.parentContainer}>
                        <Banner>
                            Look out for  <Icon glyph="Wizard" fill="#889397" /> to find out more about what is going on behind the scenes!
                        </Banner>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;