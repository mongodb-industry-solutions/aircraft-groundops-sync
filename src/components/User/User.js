"use client";

import React from 'react';
import { Body, H3 } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';

import styles from './User.module.css';

const User = ({ user = null, isSelectedUser = false, setLocalSelectedUser = null }) => {
    const selectUser = () => {
        if (!setLocalSelectedUser) return;
        setLocalSelectedUser(user);
    };

    return (
        <Card
            className={`${styles.userCard} ${user ? styles.cursorPointer : ''} ${isSelectedUser ? styles.userSelected : ''}`}
            onClick={selectUser}
            tabIndex={0}
        >
            <img
                src={`/rsc/users/${user.id}.png`}
                alt="User Avatar"
                className={styles.avatar}
            />
            <H3 className={styles.userName}>{user.name}</H3>
            <Body className={styles.userRole}>{user.role}</Body>
            <Body className={styles.userRole}> Employee ID: {user.employee}</Body>
        </Card>
    );
};

export default User;