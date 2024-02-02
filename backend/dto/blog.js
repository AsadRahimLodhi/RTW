class BlogDTO {
  constructor(blog) {
    this._id = blog.id;
    this.author = blog.author;
    this.content = blog.content;
    this.title = blog.title;
    this.photo = blog.photoPath;
  }
}

module.exports = BlogDTO;
