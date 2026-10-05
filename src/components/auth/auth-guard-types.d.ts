export type AuthGuardProps = {
 children: React.ReactNode;
 mode?: "protected" | "public";
 requireMailbox?: boolean;
 requireOperator?: boolean;
 allowAuthenticated?: boolean;
};
