"use client";


import { React, useState } from 'react';
import Login from '@/components/Login/Login';

import "./fonts.css";

const HomePage = () => {
    const [userSelected, setUserSelected] = useState(false);

    const handleUserSelected = () => {
        setUserSelected(true);
    };

    return (
        <>
            {!userSelected && <Login onUserSelected={handleUserSelected} />}
            {userSelected && <Home />}
        </>
    );
};

export default HomePage;