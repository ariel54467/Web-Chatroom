import {useState} from 'react'
import { auth, googleAuth } from "../firebase"
import { signInWithPopup } from "firebase/auth"

export const SignIn = ()  =>{
    const [email, setEmail] = useState("");
    const [password, setPass] = useState("");

    const googleSignIn = async() =>{
        try{
            await signInWithPopup(auth, googleAuth);
        }catch(error){
            alert(error)
        }
    }

    return (
        <div>
            <input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required/>
            <input placeholder="Password" type="password" value={password} onChange={(e)=> setPass(e.target.value)} required/>
            <button>Sign In</button>
            <button onClick={googleSignIn}>Sign In With Google</button>
        </div>
    )
}