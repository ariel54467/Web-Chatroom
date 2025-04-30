import { auth } from "../firebase"
import { signOut } from "firebase/auth"
import { useNavigate } from "react-router-dom"

export const Chat = () => {
    const nav = useNavigate();
    const SignOut = async() => {
        try{
            await signOut(auth);
            nav('/')
        }catch(error){
            alert(error.message);
        }
    }

    return (
        <div>
            <h1>
                Icell sayang kuu
            </h1>
                <button onClick={SignOut}>
                    Sign Out
                </button>
        </div>
    )
}