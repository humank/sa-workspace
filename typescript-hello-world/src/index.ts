/**
 * TypeScript Hello World Example
 */

// 定義一個簡單的問候函數
function greet(name: string): string {
  return `Hello, ${name}! Welcome to TypeScript!`;
}

// 主程式
function main(): void {
  const userName: string = "World";
  const message: string = greet(userName);
  
  console.log(message);
  
  // 顯示當前時間
  const currentTime: Date = new Date();
  console.log(`Current time: ${currentTime.toLocaleString()}`);
}

// 執行主程式
main();
