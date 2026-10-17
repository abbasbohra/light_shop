// Browser replacements for React Native's Alert
export const alertBox = (title: string, msg?: string) => window.alert(msg ? `${title}\n\n${msg}` : title);
export const confirmBox = (title: string, msg?: string) => window.confirm(msg ? `${title}\n\n${msg}` : title);
