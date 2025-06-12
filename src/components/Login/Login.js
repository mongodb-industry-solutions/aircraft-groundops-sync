"use client";

import React, { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import { Modal, Container } from 'react-bootstrap';
import { H2, Subtitle, Description, Body } from '@leafygreen-ui/typography';
import styles from './Login.module.css';
import User from '@/components/User/User';
import { USER_MAP } from "@/lib/constants";
import Banner from "@leafygreen-ui/banner";
import { useRouter } from 'next/navigation';

const Login = ({ onUserSelected }) => {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const [users, setUsers] = useState(
        Object.entries(USER_MAP).map(([id, details]) => ({
            id,
            name: details.UserName,
            bearerToken: details.BearerToken,
            role: details.Role
        }))
    );

    const [selectedUser, setSelectedUser] = useState(null);
    const [usersLoading, setUsersLoading] = useState(false);

    useEffect(() => {
        setOpen(true);
    }, []);

    const handleUserSelect = async (user) => {
        // Clear previous user session data
        localStorage.removeItem('selectedUser');
        
        // 
        setSelectedUser(user);
        localStorage.setItem('selectedUser', JSON.stringify(user));
        
    };


    return (
        <Modal
            show={open}
            onHide={() => {
                if (!selectedUser) {
                    alert("You must select a user before proceeding!");
                    return;
                }
                setOpen(false);
            }}
            size="lg"
            aria-labelledby="contained-modal-title-vcenter"
            centered
            fullscreen={'md-down'}
            className={styles.leafyFeel}
            backdrop="static"
        >
            <Container className="p-3 h-100">
                {!usersLoading && (
                    <div
                        className={`d-flex flex-row-reverse p-1 cursorPointer ${!selectedUser ? styles.disabledCloseButton : ''}`}
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
                )}
                <div className={styles.modalMainContent}>
                    <H2 className={styles.centerText}>Welcome to Ground Ops Sync</H2>
                    <Subtitle className={`${styles.weightNormal} ${styles.centerText} mt-2`}>This is a MongoDB demo</Subtitle>
                    <br />
                    <Description className={styles.descriptionModal}>
                        Please select the user you would like to login as:
                    </Description>

                    <div className={`${styles.usersContainer}`}>
                        {users.map(user => (
                            <User
                                user={user}
                                isSelectedUser={selectedUser && selectedUser.id === user.id}
                                key={user.id}
                                setOpen={setOpen}
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
            </Container>
        </Modal>
    );
};

export default Login;