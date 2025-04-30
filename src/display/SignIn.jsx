import {useState} from 'react'
import { auth, googleAuth } from "../firebase"
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth"

export const SignIn = ()  =>{
    const [email, setEmail] = useState("");
    const [password, setPass] = useState("");
    const nav = useNavigate();

    const googleSignIn = async() =>{
        try{
            await signInWithPopup(auth, googleAuth);
            nav('/chat')
        }catch(error){
            alert(error)
        }
    }

    const SignIn = async() =>{
        try{
            await signInWithEmailAndPassword(auth, email, password);
            nav('/chat')
        }catch(error){
            alert(error);
        }
    }

    return (
        <div>
            <input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required/>
            <input placeholder="Password" type="password" value={password} onChange={(e)=> setPass(e.target.value)} required/>
            <button onClick={SignIn}>Sign In</button>
            <button onClick={googleSignIn}>Sign In With Google</button>
            <Link to='/signup'>
                <button>Register</button>
            </Link>
        </div>
    )
}