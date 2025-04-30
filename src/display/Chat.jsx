import { auth } from "../firebase"
import { signOut } from "firebase/auth"
import { Link } from "react-router-dom"

export const Chat = () => {

    const SignOut = async() =>{
        try{
            await signOut(auth);
        }catch(error){
            alert(error);
        }
    }

    return (
        <div>
            <h1>
                Icell sayang kuu
            </h1>
            <Link to='/'>
                <button>
                    Sign Out
                </button>
            </Link>
        </div>
    )
}