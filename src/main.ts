export {}

const sandboxCanvasHeight = 800;
const sandboxCanvasWidth = 800;

const numberOfRows = 100;
const numberOfColumns = 100;



function main() {
  const sandboxCanvas = document.querySelector<HTMLCanvasElement>('#sandbox')!;
  const display = new Display(sandboxCanvas,sandboxCanvasHeight,sandboxCanvasWidth,numberOfRows, numberOfColumns)
  const sandBox = new Sandbox(display);
  sandBox.start()
}

class Point<T> {
  readonly x: number;
  readonly y: number;
  readonly value: T;
  constructor(x: number, y: number, value: T) {
    this.x = x;
    this.y = y;
    this.value = value;
  }
}

class Matrix<T> {
  private height: number;
  private width: number;
  private matrix: Array<Array<T>>;
  private fillValue: T;


  private static createMatrix<T>(height: number, width: number, fillValue: T): Array<Array<T>>{
    const rows = Array.from(Array(height));
    return rows.map(() => Array.from(Array(width).fill(fillValue)))
  }

  constructor(height: number, width: number, fillValue: T) {
    this.height = height;
    this.width = width;
    this.fillValue = fillValue;
    this.matrix = Matrix.createMatrix<T>(height, width, fillValue);
  }

  get(x: number, y: number): T | null {
    return this.matrix?.[y]?.[x] ?? null
  }

  set(x: number, y: number, value: T) {
    let pointValue = this.get(x,y);
    if(pointValue != null) {
      this.matrix[y][x] = value;
    }
    
  }

  getPoints(): Point<T>[] {
    const pointsMatrix = this.matrix.map((row, y) => row.map((value, x) => new Point(x,y,value)));
    return pointsMatrix.flat();
  }


  setPoints(points: Point<T>[]): void {
    points.forEach(point => this.matrix[point.y][point.x] = point.value);
  }

  map<R>(mapFn: (value:T, x: number, y: number) => R): Matrix<R> {
    const matrix = new Matrix<R | null>(this.height, this.width, null);
    matrix.setPoints(this.getPoints().map(point => new Point(point.x, point.y, mapFn(point.value, point.x, point.y))))
    return matrix as Matrix<R>;
  }

  forEach(forEachFn: (value: T, x: number, y: number)=> void): void {
    this.getPoints().forEach(point => forEachFn(point.value, point.x, point.y));
  }

  copy(): Matrix<T> {
    const newMatrix = new Matrix<T>(this.height, this.width, this.fillValue);
    newMatrix.setPoints(this.getPoints());
    return newMatrix;
  }
}

class Pixel {
  private hue: number;
  private saturation: number;
  private lightness: number;

  constructor(hue: number, saturation: number = 100, lightness: number = 50) {
    this.hue = hue;
    this.saturation = saturation;
    this.lightness = lightness;
  }

  toCss(): string {
    return `hsl(${this.hue}, ${this.saturation}%, ${this.lightness}%`
  }
}

enum MouseButtonType {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
}

class Display {
  readonly height: number;
  readonly width: number;
  private ctx: CanvasRenderingContext2D;
  private _onClick: (x: number, y: number, mouseButtonType: MouseButtonType) => void = () => {/*void*/};
  fps = 0;
  maxFps = 30;
  pixelHeight: number;
  pixelWidth: number;
  lastCalledTime;
  selectedMouseButtonType: MouseButtonType = MouseButtonType.LEFT;

  constructor(canvas: HTMLCanvasElement,height: number,width: number, rows: number, columns: number) {
    canvas.height = height;
    canvas.width = width;
    this.height = rows;
    this.width = columns;
    this.pixelHeight = Math.floor(height/rows);
    this.pixelWidth = Math.floor(width/columns);
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.lastCalledTime = performance.now();
    this.initEvents();
  }

  setPixel(x: number, y: number, pixel: Pixel) {
    this.ctx.fillStyle = pixel.toCss();
    this.ctx.fillRect(x * this.pixelWidth,y * this.pixelHeight,this.pixelWidth,this.pixelHeight);
  }

  paintMatrix(matrix: Matrix<Pixel>) {
    matrix.getPoints().forEach(point => this.setPixel(point.x, point.y, point.value));
    window.requestAnimationFrame(() => this.updateFps());
  }

  updateFps() {
    const delta = (Date.now() - this.lastCalledTime)/1000;
    this.lastCalledTime = performance.now();
    this.fps = 1/delta;
    document.title = this.fps.toString();
  }

  private initEvents() {
    this.ctx.canvas.addEventListener('mousedown', (event: MouseEvent) => {
      this.selectedMouseButtonType = event.button;
      const pixelX = Math.floor(event.offsetX/this.pixelWidth);
      const pixelY = Math.floor(event.offsetY/this.pixelHeight);
      this._onClick(pixelX, pixelY, this.selectedMouseButtonType);
      this.startDrawing();
    })
    this.ctx.canvas.addEventListener('mouseup',() => {
      this.stopDrawing();
    })
    this.ctx.canvas.addEventListener('mouseleave',() => {
      this.stopDrawing();
    })

    this.ctx.canvas.addEventListener('contextmenu', event => {
      event.preventDefault();
    })
  }

  startDrawing() {
    this.ctx.canvas.addEventListener('mousemove' ,this.handleCanvasMouseMove, false);
  }

  stopDrawing() {
    this.ctx.canvas.removeEventListener('mousemove' ,this.handleCanvasMouseMove, false);
  }

  private handleCanvasMouseMove = (mouseEvent: MouseEvent) => {
    const event = this.adaptMouseEvent(mouseEvent);
    this._onClick(event.offsetX, event.offsetY, this.selectedMouseButtonType);
  }

  private adaptMouseEvent(event: MouseEvent)  {
    return {
      ...event,
      offsetX: Math.floor(event.offsetX/this.pixelWidth),
      offsetY:  Math.floor(event.offsetY/this.pixelHeight)
    }
  }



  onClick(onClickFn: (x: number, y: number, mouseButtonType: MouseButtonType) => void) {
      this._onClick = onClickFn;
  }

}

class Sandbox {

  isPlaying = true;
  display: Display;
  matrix: Matrix<Atom>;
  universe = new Universe();
  fps = 30
  velocity = 1;

  constructor(display: Display) {
    this.display = display;
    this.matrix = new Matrix(display.height, display.width, Atom.createVoid());
    this.display.onClick((x,y, mouseButtonType) => {
      switch (mouseButtonType) {
        case MouseButtonType.LEFT:
          this.setAtom(x,y, new Atom(ElementType.SAND), 1);
          break;
        case MouseButtonType.MIDDLE: 
          this.setAtom(x,y, new Atom(ElementType.VOID));
          break;
        case MouseButtonType.RIGHT:
          this.setAtom(x,y, new Atom(ElementType.WATER),2);
          break;  
      }
    });
  }

  setAtom(x: number, y: number, atom: Atom, brushSize: number = 0) {
    for (let cursorX = x - brushSize; cursorX < x + brushSize + 1; cursorX++) {
      for (let cursorY = y - brushSize; cursorY < y + brushSize + 1; cursorY++) {
        this.matrix.set(cursorX,cursorY,atom);
      }
    }
    
  }

  start() {
    setInterval(() => this.displayNextState(), 1000/this.fps)
  }

  displayNextState() {
    for (let i = 0; i < this.velocity; i++) {
      this.matrix = this.universe.nextState(this.matrix);
    }
    this.displayMatrix(this.matrix);
  }
  

  pause() {
    this.isPlaying = false;
  }

  private displayMatrix(matrix: Matrix<Atom>) {
      this.display.paintMatrix(matrix.map(this.atomToPixel))
  }

  private atomToPixel(atom: Atom): Pixel {
    switch (atom.type) {
      case ElementType.SAND:
        return new Pixel(51,66,76);
      case ElementType.WATER: 
        return new Pixel(199,80,68);
      case ElementType.VOID:  
      default:
        return new Pixel(0,0,0); 
    }
  }
}

class Universe {

  nextState(matrix: Matrix<Atom>): Matrix<Atom> {
    const nextStepMatrix = matrix.copy();
    matrix.forEach((atom, x, y) => {
      if(!atom || atom.isEmpty()) {
       return;
      }
      const bottomAtom = matrix.get(x,y + 1);
      if (bottomAtom == null) {
        if (nextStepMatrix.get(x, y) == null) nextStepMatrix.set(x,y,atom);
        return;
      }

      if (bottomAtom.isEmpty()) {
        nextStepMatrix.set(x,y, nextStepMatrix.get(x,y + 1) ?? Atom.createVoid());
        nextStepMatrix.set(x, y + 1, atom);
        return;
      }

      
      const bottomLeftAtom = matrix.get(x - 1,y + 1);
      if (bottomLeftAtom?.isEmpty()) {
        nextStepMatrix.set(x,y, nextStepMatrix.get(x - 1, y + 1) ?? Atom.createVoid());
        nextStepMatrix.set(x - 1, y + 1, atom);
        return;
      }

      const bottomRightAtom = matrix.get(x + 1,y + 1);
      if (bottomRightAtom?.isEmpty()) {
        nextStepMatrix.set(x,y,nextStepMatrix.get(x + 1, y + 1) ?? Atom.createVoid());
        nextStepMatrix.set(x + 1, y + 1, atom);
        return;
      }

      if(atom.type === ElementType.SAND && bottomAtom?.type === ElementType.WATER) {
        console.log('hola')
        nextStepMatrix.set(x,y, nextStepMatrix.get(x, y + 1) ?? bottomAtom);
        nextStepMatrix.set(x, y + 1, atom);
        return;
      }

  

      if(atom.type == ElementType.WATER) {
        const leftAtom = matrix.get(x - 1,y);
        const rightAtom = matrix.get(x + 1,y);

        if(leftAtom?.isEmpty() && rightAtom?.isEmpty()) {
          //nextStepMatrix.set(x,y,Atom.createVoid());
          return;
        }

        if (leftAtom?.isEmpty()) {
          nextStepMatrix.set(x,y,nextStepMatrix.get(x - 1, y) ?? Atom.createVoid());
          nextStepMatrix.set(x - 1, y, atom);
          return;
        }
        
        if (rightAtom?.isEmpty()) {
          nextStepMatrix.set(x,y,nextStepMatrix.get(x + 1, y) ?? Atom.createVoid());
          nextStepMatrix.set(x + 1, y, atom);
          return;
        }
      }
    

     if (nextStepMatrix.get(x, y) == null) nextStepMatrix.set(x,y,atom);
      
     
    })
    return nextStepMatrix;
  }


}

class Atom {
  type: ElementType;
  constructor(type: ElementType) {
    this.type = type;
  }

  isEmpty(): boolean {
    return this.type === ElementType.VOID;
  }

  static createVoid() {
    return new Atom(ElementType.VOID);
  }

  copy(): Atom {
    return new Atom(this.type);
  }
}

enum ElementType {
  VOID,
  SAND,
  WATER,
}


main();
