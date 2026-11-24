// Dữ liệu sản phẩm của cửa hàng trái cây sấy Hưng Phát
var PRODUCTS = [
  {id:'xoai', name:'Xoài sấy dẻo', price:89000, old:119000, badge:'Best seller', rating:4.5, reviews:128, stock:15, sold:350, cat:'Trái cây sấy dẻo',
   desc:'Xoài cát Hòa Lộc chín cây, sấy lạnh giữ màu vàng tự nhiên, vị chua ngọt, dẻo mềm. Không đường hóa học, không chất bảo quản.'},
  {id:'mit', name:'Mít sấy giòn', price:75000, old:95000, badge:'New', rating:4.0, reviews:56, stock:45, sold:120, cat:'Trái cây sấy giòn',
   desc:'Mít Thái múi dày, sấy chân không ở nhiệt độ thấp nên giòn rụm, giữ được mùi thơm đặc trưng.'},
  {id:'chuoi', name:'Chuối sấy', price:55000, old:65000, badge:'', rating:4.0, reviews:40, stock:88, sold:210, cat:'Trái cây sấy dẻo',
   desc:'Chuối xiêm chín vàng sấy dẻo, ngọt thanh tự nhiên, thích hợp làm món ăn vặt cho cả gia đình.'},
  {id:'thom', name:'Thơm sấy dẻo', price:69000, old:89000, badge:'New', rating:3.5, reviews:22, stock:30, sold:60, cat:'Trái cây sấy dẻo',
   desc:'Thơm Cầu Đúc Hậu Giang cắt khoanh, sấy dẻo, vị chua ngọt hài hòa.'},
  {id:'dau', name:'Dâu tây sấy', price:129000, old:159000, badge:'Best seller', rating:5.0, reviews:97, stock:15, sold:410, cat:'Trái cây sấy dẻo',
   desc:'Dâu tây Đà Lạt sấy lạnh, giữ trọn màu đỏ và hương vị tươi mới.'},
  {id:'khoai', name:'Khoai lang sấy', price:49000, old:59000, badge:'', rating:4.0, reviews:35, stock:64, sold:150, cat:'Nông sản sấy',
   desc:'Khoai lang mật Đà Lạt sấy dẻo, ngọt bùi, giàu chất xơ.'},
  {id:'dieu', name:'Hạt điều rang muối', price:189000, old:229000, badge:'Best seller', rating:4.5, reviews:150, stock:55, sold:520, cat:'Hạt dinh dưỡng',
   desc:'Hạt điều Bình Phước loại A, rang muối còn vỏ lụa, béo bùi, giòn thơm.'},
  {id:'nho', name:'Nho khô', price:99000, old:115000, badge:'', rating:3.5, reviews:18, stock:8, sold:90, cat:'Trái cây sấy dẻo',
   desc:'Nho Ninh Thuận phơi tự nhiên, ngọt đậm, dùng ăn trực tiếp hoặc làm bánh.'},
  {id:'chanhday', name:'Chanh dây sấy', price:79000, old:99000, badge:'New', rating:4.0, reviews:12, stock:40, sold:35, cat:'Trái cây sấy dẻo',
   desc:'Chanh dây sấy dẻo cả hạt, vị chua thanh đặc trưng, rất hợp pha trà.'}
];
function vnd(n){ return n.toLocaleString('vi-VN') + 'đ'; }
function discount(p){ return Math.round((1 - p.price / p.old) * 100); }
function stockInfo(p){
  var pct = Math.min(100, p.stock); // kho tối đa 100 gói
  var cls = pct > 50 ? 'progress-bar-success' : (pct > 20 ? 'progress-bar-warning' : 'progress-bar-danger');
  var txt = pct > 50 ? 'Còn nhiều hàng' : (pct > 20 ? 'Sắp hết hàng' : 'Chỉ còn ít hàng');
  return {pct:pct, cls:cls, txt:txt};
}
