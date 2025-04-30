import {useState} from "react"
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase"
import { createUserWithEmailAndPassword, signOut } from "firebase/auth"

export const SignUp = () =>{
    const [email, setEmail] = useState("");
    const [password, setPass] = useState("");
    const nav = useNavigate();

    const signUp = async() =>{
        try{
            await createUserWithEmailAndPassword(auth, email, password);
            await signOut(auth);
            nav('/signin');
        }catch(error){
            alert(error);
        }
    }

    return(
        <div>
            <input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
            <input placeholder="Password" type="password" value={password} onChange={(e)=>setPass(e.target.value)} />
            <Link>
                <button onClick={signUp}>
                    Sign Up
                </button>
            </Link>
        </div>
    )
}