import { useEffect, useRef, useState } from "react";
import logo from "../assets/logo.jpeg";

export default function Preloader({ onDone }) {
  const [hidden, setHidden] = useState(false);
  const notified = useRef(false);

  useEffect(() => {
    const finish = () => {
      setHidden(true);
      if (!notified.current) {
        notified.current = true;
        setTimeout(() => onDone?.(), 700);
      }
    };
    const timer = setTimeout(finish, 900);
    window.addEventListener("load", () => setTimeout(finish, 400));
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div id="preloader" className={hidden ? "hidden" : ""} aria-hidden="true">
      <div className="preloader-inner">
        <img src={logo} alt="" className="preloader-logo" width="96" height="96" />
        <div className="preloader-bar">
          <span></span>
        </div>
      </div>
    </div>
  );
}