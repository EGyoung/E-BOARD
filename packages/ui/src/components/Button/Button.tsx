import React from "react";
import classNames from "classnames";
import styles from "./Button.less";

interface ButtonProps {
  type?: "primary" | "default";
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  type = "default",
  className,
  children,
  onClick,
}) => {
  return (
    <button
      className={classNames(styles.button, styles[type], className)}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
